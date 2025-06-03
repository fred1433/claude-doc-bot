import express, { Application } from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs-extra';
import { ClaudeWorker } from '@claude-doc-bot/worker';

interface Job {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  currentTask: string;
  results: any[];
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

class JobManager {
  private jobs = new Map<string, Job>();
  private wss: WebSocketServer;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
  }

  createJob(): string {
    const id = uuidv4();
    const job: Job = {
      id,
      status: 'pending',
      progress: 0,
      total: 0,
      currentTask: '',
      results: [],
      createdAt: new Date(),
    };

    this.jobs.set(id, job);
    return id;
  }

  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  updateJob(id: string, updates: Partial<Job>): void {
    const job = this.jobs.get(id);
    if (!job) return;

    Object.assign(job, updates);
    this.jobs.set(id, job);

    // Diffuser la mise à jour via WebSocket
    this.broadcast({
      type: 'job_update',
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        total: job.total,
        currentTask: job.currentTask,
        completedAt: job.completedAt,
        error: job.error,
      },
    });
  }

  async runJob(id: string, customPrompts?: string[]): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) throw new Error('Job not found');

    try {
      this.updateJob(id, { status: 'running', currentTask: 'Initializing...' });

      let prompts: string[];

      if (customPrompts && customPrompts.length > 0) {
        // Utiliser les prompts personnalisés
        prompts = customPrompts;
        this.updateJob(id, { currentTask: 'Using custom prompts...' });
      } else {
        // Utiliser les fichiers de prompts par défaut
        this.updateJob(id, { currentTask: 'Loading demo prompts...' });
        
        const promptsDir = path.resolve('../prompts');
        
        const files = await fs.readdir(promptsDir);
        const promptFiles = files
          .filter((f: string) => f.endsWith('.txt'))
          .map((f: string) => path.join(promptsDir, f));

        if (promptFiles.length === 0) {
          throw new Error('No .txt files found in prompts folder');
        }

        // Charger les prompts depuis les fichiers
        prompts = [];
        for (const file of promptFiles) {
          const content = await fs.readFile(file, 'utf-8');
          prompts.push(content.trim());
        }
      }

      this.updateJob(id, { total: prompts.length });

      // Initialiser le worker Claude
      const worker = new ClaudeWorker();
      await worker.init();

      try {
        // Créer un dossier unique pour ce job
        const jobOutputDir = path.resolve('../outputs', id);
        await fs.ensureDir(jobOutputDir);

        const results = await worker.runJob({
          prompts,
          outputDir: jobOutputDir,
          onProgress: (current, total, status) => {
            this.updateJob(id, {
              progress: current,
              total,
              currentTask: status,
            });
            
            // Log détaillé via WebSocket
            this.broadcast({
              type: 'log',
              message: `[${current}/${total}] ${status}`,
              timestamp: new Date().toISOString(),
            });
          },
        });

        this.updateJob(id, {
          status: 'completed',
          progress: prompts.length,
          currentTask: 'Completed successfully',
          results,
          completedAt: new Date(),
        });

        // Envoyer le résumé final
        const successful = results.filter(r => r.success).length;
        this.broadcast({
          type: 'job_completed',
          message: `✨ Job completed: ${successful}/${results.length} prompts processed successfully`,
          results,
        });

        // Auto-cleanup après 1 heure (3600000 ms)
        setTimeout(async () => {
          try {
            await fs.remove(jobOutputDir);
            console.log(`🧹 Auto-cleaned job ${id} outputs`);
          } catch (error) {
            console.error(`Error cleaning job ${id}:`, error);
          }
        }, 3600000); // 1 heure

      } finally {
        await worker.cleanup();
      }

    } catch (error) {
      console.error('Error executing job:', error);
      this.updateJob(id, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        currentTask: 'Failed',
        completedAt: new Date(),
      });

      this.broadcast({
        type: 'job_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private broadcast(data: any): void {
    const message = JSON.stringify(data);
    this.wss.clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    });
  }
}

// Configuration du serveur
const app: Application = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const jobManager = new JobManager(wss);

// Middleware
app.use(cors());
app.use(express.json());

// Route pour servir les fichiers par job ID (sécurisé)
app.get('/outputs/:jobId/:filename', async (req, res) => {
  try {
    const { jobId, filename } = req.params;
    
    // Vérifier que le job existe et appartient à l'utilisateur
    const job = jobManager.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const filePath = path.resolve('../outputs', jobId, filename);
    
    // Vérifier que le fichier existe
    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Servir le fichier avec les bons headers
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Routes API
app.post('/api/run', async (req, res) => {
  try {
    const jobId = jobManager.createJob();
    
    // Lancer le job de manière asynchrone
    jobManager.runJob(jobId, req.body.prompts).catch(error => {
      console.error('Job error:', error);
    });

    res.json({ jobId, status: 'started' });
  } catch (error) {
    console.error('Error starting job:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

app.get('/api/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobManager.getJob(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    total: job.total,
    currentTask: job.currentTask,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    error: job.error,
    results: job.results,
  });
});

app.get('/api/outputs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Vérifier que le job existe
    const job = jobManager.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const jobOutputDir = path.resolve('../outputs', jobId);
    
    // Vérifier que le dossier existe
    if (!(await fs.pathExists(jobOutputDir))) {
      return res.json({ outputs: [] });
    }
    
    const files = await fs.readdir(jobOutputDir);
    const outputs = files
      .filter((f: string) => f.endsWith('.md'))
      .map((f: string) => ({
        filename: f,
        downloadUrl: `/outputs/${jobId}/${f}`,
      }));

    res.json({ outputs });
  } catch (error) {
    console.error('Error reading outputs:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Gestion WebSocket
wss.on('connection', (ws) => {
  console.log('🔌 New WebSocket connection');
  
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'WebSocket connection established',
  }));

  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
  });
});

// Démarrage du serveur
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 API Server started on port ${PORT}`);
  console.log(`📡 WebSocket Server enabled`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

export default app; 