"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, RefreshCw, FileText } from 'lucide-react';

// Simple markdown to HTML converter
function markdownToHtml(markdown: string): string {
  let html = markdown;
  
  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>');
  
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
  
  // Code blocks
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-muted p-4 rounded-md overflow-x-auto my-4"><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');
  
  // Lists
  html = html.replace(/^- \[([ x])\] (.*$)/gim, '<li class="ml-4 list-none"><input type="checkbox" $1 disabled class="mr-2" />$2</li>');
  html = html.replace(/^- (.*$)/gim, '<li class="ml-4 list-disc">$1</li>');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank">$1</a>');
  
  // Paragraphs
  html = html.split('\n\n').map(para => {
    if (para.trim() && !para.match(/^<[h|u|o|l|p]/)) {
      return `<p class="mb-3">${para.trim()}</p>`;
    }
    return para;
  }).join('\n');
  
  // Horizontal rules
  html = html.replace(/^---$/gim, '<hr class="my-4 border-border" />');
  
  // Line breaks
  html = html.replace(/\n/g, '<br />');
  
  return html;
}

export default function TasksPage() {
  const [tasksContent, setTasksContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = () => {
    setLoading(true);
    setError(null);
    
    // Try to fetch from public folder first
    fetch('/TASKS.md')
      .then(response => {
        if (!response.ok) {
          // If not in public, try API route
          return fetch('/api/tasks');
        }
        return response;
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load tasks file. Make sure TASKS.md exists in root directory.');
        }
        return response.text();
      })
      .then(text => {
        setTasksContent(text);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadTasks();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-4 text-muted-foreground">Loading tasks...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Error Loading Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive mb-4">{error}</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><strong>To fix this:</strong></p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Make sure TASKS.md file exists in the root directory</li>
                <li>Or create an API route at <code className="bg-muted px-1 py-0.5 rounded">/api/tasks</code> to serve the file</li>
                <li>Or copy TASKS.md to the <code className="bg-muted px-1 py-0.5 rounded">PUBLIC</code> folder</li>
              </ol>
            </div>
            <Button onClick={loadTasks} className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const htmlContent = markdownToHtml(tasksContent);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Task Progress Tracker</h1>
          <p className="text-muted-foreground">
            View and track all improvement tasks for the software
          </p>
        </div>
        <Button onClick={loadTasks} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tasks Overview</CardTitle>
          <CardDescription>
            This file tracks all pending improvements and their completion status. 
            Update TASKS.md file to mark tasks as complete.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div 
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button onClick={loadTasks} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Tasks
            </Button>
            <Button 
              onClick={() => {
                // Try to open in VS Code/Cursor
                const filePath = window.location.origin.includes('localhost') 
                  ? 'file:///' + process.cwd().replace(/\\/g, '/') + '/TASKS.md'
                  : '/TASKS.md';
                window.open(filePath, '_blank');
              }}
              variant="outline"
            >
              <FileText className="mr-2 h-4 w-4" />
              Open File
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            💡 <strong>Tip:</strong> Edit TASKS.md file directly in your editor. 
            Change <code className="bg-muted px-1 py-0.5 rounded">⬜</code> to <code className="bg-muted px-1 py-0.5 rounded">✅</code> when tasks are complete.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

