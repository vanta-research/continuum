'use client';

import { useState } from 'react';
import { Settings as SettingsIcon, Save, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';

export default function Settings() {
  const [serverUrl, setServerUrl] = useState('http://localhost:8082');
  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState([2048]);
  const [streamResponse, setStreamResponse] = useState(true);
  const [selectedModel, setSelectedModel] = useState('atom');
  const [saveMessage, setSaveMessage] = useState('');

  const handleSave = async () => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serverUrl,
          temperature: temperature[0],
          maxTokens: maxTokens[0],
          streamResponse,
          selectedModel,
        }),
      });

      if (response.ok) {
        setSaveMessage('Settings saved successfully');
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage('Failed to save settings');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleTestConnection = async () => {
    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serverUrl }),
      });

      const data = await response.json();

      if (data.connected) {
        setSaveMessage('Connection successful!');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        setSaveMessage('Connection failed: ' + data.error);
        setTimeout(() => setSaveMessage(''), 5000);
      }
    } catch (error) {
      setSaveMessage('Connection failed: Server not reachable');
      setTimeout(() => setSaveMessage(''), 5000);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-zinc-950/50">
      <header className="border-b border-border/50 glass-strong">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 ring-1 ring-primary/20">
              <SettingsIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Settings</h1>
              <p className="text-sm text-muted-foreground">Configure your VANTA Research experience</p>
            </div>
          </div>

          {saveMessage && (
            <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Check className="h-4 w-4" />
              {saveMessage}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleTestConnection}>
              Test Connection
            </Button>
            <Button onClick={handleSave} className="gap-2">
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <Card className="glass-strong">
            <div className="p-6 space-y-6">
              <div>
                <h2 className="mb-4 text-lg font-semibold">Server Configuration</h2>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger className="bg-background/50">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="atom">Atom (Local)</SelectItem>
                        <SelectItem value="atom-large-experimental">Atom-Large-Experimental</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Select the AI model to use for conversations
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="serverUrl">LLaMA Server URL</Label>
                    <Input
                      id="serverUrl"
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                      placeholder="http://localhost:8080"
                      className="bg-background/50"
                    />
                    <p className="text-xs text-muted-foreground">
                      The URL of your llama.cpp server instance (for Atom model)
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-border/50 pt-6">
                <h2 className="mb-4 text-lg font-semibold">Model Parameters</h2>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="temperature">Temperature</Label>
                      <span className="text-sm text-muted-foreground">{temperature[0].toFixed(2)}</span>
                    </div>
                    <Slider
                      id="temperature"
                      value={temperature}
                      onValueChange={setTemperature}
                      min={0}
                      max={2}
                      step={0.1}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Controls randomness. Lower values produce more deterministic responses.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="maxTokens">Max Tokens</Label>
                      <span className="text-sm text-muted-foreground">{maxTokens[0]}</span>
                    </div>
                    <Slider
                      id="maxTokens"
                      value={maxTokens}
                      onValueChange={setMaxTokens}
                      min={256}
                      max={8192}
                      step={128}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum number of tokens in the response.
                    </p>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-muted/30 p-4">
                    <div className="space-y-1">
                      <Label htmlFor="streamResponse">Stream Responses</Label>
                      <p className="text-xs text-muted-foreground">
                        Display responses as they are generated
                      </p>
                    </div>
                    <Switch
                      id="streamResponse"
                      checked={streamResponse}
                      onCheckedChange={setStreamResponse}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-border/50 pt-6">
                <h2 className="mb-4 text-lg font-semibold">About</h2>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>VANTA Research Chat Interface</p>
                  <p>Designed for clean, professional AI interactions.</p>
                  <p className="mt-4">Version: 1.0.0</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
