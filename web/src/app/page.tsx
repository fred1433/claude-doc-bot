'use client';

import { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Job {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  currentTask: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
  results?: any[];
}

interface Output {
  filename: string;
  downloadUrl: string;
}

export default function HomePage() {
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [prompts, setPrompts] = useState<string[]>(['']);
  const [useCustomPrompts, setUseCustomPrompts] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

  const { isConnected, logs, clearLogs } = useWebSocket(wsUrl, {
    onMessage: (message) => {
      if (message.type === 'job_update' && message.job) {
        setCurrentJob(message.job);
        
        // Si le job est complété, fetch ses outputs
        if (message.job.status === 'completed') {
          fetchOutputs(message.job.id);
        }
      }
      
      if (message.type === 'job_completed' && currentJob?.id) {
        fetchOutputs(currentJob.id);
      }
    },
  });

  const fetchOutputs = async (jobId?: string) => {
    if (!jobId) return;
    
    try {
      const response = await fetch(`${apiUrl}/api/outputs/${jobId}`);
      const data = await response.json();
      setOutputs(data.outputs || []);
    } catch (error) {
      console.error('Error fetching outputs:', error);
    }
  };

  const addPrompt = () => {
    setPrompts([...prompts, '']);
  };

  const updatePrompt = (index: number, value: string) => {
    const newPrompts = [...prompts];
    newPrompts[index] = value;
    setPrompts(newPrompts);
  };

  const removePrompt = (index: number) => {
    if (prompts.length > 1) {
      setPrompts(prompts.filter((_, i) => i !== index));
    }
  };

  const startJob = async () => {
    try {
      setIsLoading(true);
      clearLogs();
      setOutputs([]); // Clear previous outputs
      
      const requestBody = useCustomPrompts 
        ? { prompts: prompts.filter(p => p.trim()) }
        : {};
      
      const response = await fetch(`${apiUrl}/api/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      if (data.jobId) {
        // Polling pour récupérer le statut du job
        const pollJob = async () => {
          try {
            const statusResponse = await fetch(`${apiUrl}/api/status/${data.jobId}`);
            const jobData = await statusResponse.json();
            setCurrentJob(jobData);
            
            if (jobData.status === 'running') {
              setTimeout(pollJob, 1000);
            } else if (jobData.status === 'completed') {
              fetchOutputs(data.jobId);
            }
          } catch (error) {
            console.error('Error polling job:', error);
          }
        };
        
        pollJob();
      }
    } catch (error) {
      console.error('Error starting job:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'running': return 'status-running';
      case 'completed': return 'status-completed';
      case 'failed': return 'status-failed';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US');
  };

  const canStartJob = !isLoading && (!currentJob || ['completed', 'failed'].includes(currentJob.status));
  const validPrompts = prompts.filter(p => p.trim()).length;

  return (
    <div className="space-y-8">
      {/* Prompt Input Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Prompt Configuration</h2>
            <p className="text-gray-600 mt-1">
              Choose between demo prompts or create your own custom prompts
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                checked={!useCustomPrompts}
                onChange={() => setUseCustomPrompts(false)}
                className="text-blue-600"
              />
              <span>Use demo prompts (recommended for testing)</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                checked={useCustomPrompts}
                onChange={() => setUseCustomPrompts(true)}
                className="text-blue-600"
              />
              <span>Use custom prompts</span>
            </label>
          </div>

          {!useCustomPrompts && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Demo Prompts Available:</h4>
              <ul className="text-blue-800 text-sm space-y-1">
                <li>• REST API documentation for user management</li>
                <li>• Node.js deployment guide with Docker</li>
              </ul>
            </div>
          )}

          {useCustomPrompts && (
            <div className="space-y-4">
              {prompts.map((prompt, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      Prompt {index + 1}
                    </label>
                    {prompts.length > 1 && (
                      <button
                        onClick={() => removePrompt(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <textarea
                    value={prompt}
                    onChange={(e) => updatePrompt(index, e.target.value)}
                    placeholder="Enter your documentation prompt here... (e.g., 'Create a comprehensive API guide for user authentication')"
                    className="w-full h-24 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              ))}
              
              <button
                onClick={addPrompt}
                className="btn-secondary flex items-center space-x-2"
              >
                <span>➕</span>
                <span>Add Another Prompt</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Job Control Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Job Control</h2>
            <p className="text-gray-600 mt-1">
              Launch documentation automation via Claude.ai
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 text-sm ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            <button
              onClick={startJob}
              disabled={!canStartJob || (useCustomPrompts && validPrompts === 0)}
              className="btn-primary flex items-center space-x-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>
                    Run Job {useCustomPrompts && `(${validPrompts} prompts)`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Current Job Status */}
        {currentJob && (
          <div className={`border rounded-lg p-4 ${getStatusColor(currentJob.status)}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="font-medium">Job {currentJob.id.slice(0, 8)}</span>
                <span className="text-sm capitalize">{currentJob.status}</span>
              </div>
              <div className="text-sm">
                {currentJob.progress}/{currentJob.total}
              </div>
            </div>
            
            {currentJob.total > 0 && (
              <div className="w-full bg-white/30 rounded-full h-2 mb-2">
                <div
                  className="bg-current h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(currentJob.progress / currentJob.total) * 100}%`,
                  }}
                ></div>
              </div>
            )}
            
            <div className="text-sm">
              {currentJob.currentTask && (
                <div className="mb-1">{currentJob.currentTask}</div>
              )}
              
              {currentJob.status === 'running' && (
                <div className="flex items-center space-x-1 text-xs">
                  <div className="animate-pulse-slow">●</div>
                  <span>Claude processing...</span>
                </div>
              )}
              
              {currentJob.error && (
                <div className="text-red-700 font-medium">{currentJob.error}</div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Real-time Logs Section */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Real-time Logs</h3>
            <button
              onClick={clearLogs}
              className="btn-secondary text-sm"
            >
              Clear
            </button>
          </div>
          
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg h-64 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-gray-500">Waiting for logs...</div>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="flex space-x-2">
                    <span className="text-gray-500 text-xs">
                      {formatTimestamp(log.timestamp)}
                    </span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Generated Files Section */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Generated Files</h3>
          
          {outputs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📄</div>
              <div>No files generated yet</div>
              <div className="text-sm mt-1">Run a job to get started</div>
            </div>
          ) : (
            <div className="space-y-3">
              {outputs.map((output, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                >
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">📋</div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {output.filename}
                      </div>
                      <div className="text-sm text-gray-500">
                        Generated documentation
                      </div>
                    </div>
                  </div>
                  
                  <a
                    href={`${apiUrl}${output.downloadUrl}`}
                    download
                    className="btn-primary text-sm"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Help Section */}
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">How it works?</h3>
        <div className="text-blue-800 space-y-2 text-sm">
          <p>1. Choose between demo prompts (for testing) or enter your own custom prompts</p>
          <p>2. Click "Run Job" to start the automation</p>
          <p>3. Follow real-time progress in the logs</p>
          <p>4. Download generated documentation files once completed</p>
        </div>
      </div>
    </div>
  );
} 