import { useState, useCallback } from 'react';
import { AnalysisResult } from '@workspace/api-client-react';

export type StreamStatus = 'idle' | 'analyzing' | 'completed' | 'error';

export interface StreamState {
  status: StreamStatus;
  progress: number;
  step: string;
  message: string;
  error?: string;
  resultId?: string;
  fullResult?: AnalysisResult;
}

export function useAnalysisStream() {
  const [state, setState] = useState<StreamState>({
    status: 'idle',
    progress: 0,
    step: 'Initializing',
    message: 'Preparing document for analysis...',
  });

  const startAnalysis = useCallback(async (documentId: string) => {
    setState({
      status: 'analyzing',
      progress: 5,
      step: 'Extracting',
      message: 'Reading document text...',
    });

    try {
      const response = await fetch(`/api/documents/${documentId}/analyze`, {
        method: 'POST',
        headers: {
          'Accept': 'text/event-stream',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to start analysis: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported in this browser.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // SSE messages are separated by \n\n
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep the last incomplete part in the buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const dataStr = line.replace('data: ', '').trim();
              if (!dataStr) continue;
              
              const event = JSON.parse(dataStr);

              if (event.type === 'progress') {
                setState(prev => ({
                  ...prev,
                  progress: event.progress || prev.progress,
                  step: event.step || prev.step,
                  message: event.message || prev.message,
                }));
              } else if (event.type === 'result') {
                setState(prev => ({
                  ...prev,
                  resultId: event.data.analysisId,
                  fullResult: event.data,
                }));
              } else if (event.type === 'error') {
                setState(prev => ({
                  ...prev,
                  status: 'error',
                  error: event.message || 'An error occurred during analysis.',
                }));
                return; // Stop processing on error
              } else if (event.type === 'done') {
                setState(prev => ({ ...prev, status: 'completed', progress: 100 }));
                return; // Stream finished
              }
            } catch (e) {
              console.warn("Failed to parse SSE event", e, line);
            }
          }
        }
      }
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: err.message || 'Connection lost',
      }));
    }
  }, []);

  const resetStream = useCallback(() => {
    setState({
      status: 'idle',
      progress: 0,
      step: 'Initializing',
      message: 'Preparing document for analysis...',
    });
  }, []);

  return { ...state, startAnalysis, resetStream };
}
