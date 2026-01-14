"use client";

import { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  Save,
  Check,
  Download,
  ArrowLeft,
  Key,
  Eye,
  EyeOff,
  Palette,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import ModelDownloader from "@/components/model-downloader";
import {
  useAccentColor,
  ACCENT_COLORS,
  AccentColor,
} from "@/components/accent-color-provider";

export default function Settings() {
  const [serverUrl, setServerUrl] = useState("http://localhost:8082");
  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState([2048]);
  const [streamResponse, setStreamResponse] = useState(true);
  const [selectedModel, setSelectedModel] = useState("atom");
  const [hfToken, setHfToken] = useState("");
  const [mistralApiKey, setMistralApiKey] = useState("");
  const [showMistralKey, setShowMistralKey] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"general" | "models">("general");
  const { accentColor, setAccentColor } = useAccentColor();

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const data = await response.json();
          if (data.settings) {
            if (data.settings.serverUrl) setServerUrl(data.settings.serverUrl);
            if (data.settings.temperature !== undefined)
              setTemperature([data.settings.temperature]);
            if (data.settings.maxTokens !== undefined)
              setMaxTokens([data.settings.maxTokens]);
            if (data.settings.streamResponse !== undefined)
              setStreamResponse(data.settings.streamResponse);
            if (data.settings.selectedModel)
              setSelectedModel(data.settings.selectedModel);
            if (data.settings.hfToken) setHfToken(data.settings.hfToken);
            if (data.settings.mistralApiKey)
              setMistralApiKey(data.settings.mistralApiKey);
          }
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serverUrl,
          temperature: temperature[0],
          maxTokens: maxTokens[0],
          streamResponse,
          selectedModel,
          hfToken,
          mistralApiKey,
        }),
      });

      if (response.ok) {
        setSaveMessage("Settings saved successfully");
        setTimeout(() => setSaveMessage(""), 3000);
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      setSaveMessage("Failed to save settings");
      setTimeout(() => setSaveMessage(""), 3000);
    }
  };

  const handleTestConnection = async () => {
    setSaveMessage("Testing connection...");
    try {
      const response = await fetch("/api/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ serverUrl }),
      });

      const data = await response.json();

      if (data.connected) {
        if (data.modelLoaded === false) {
          // Server running but no model loaded
          setSaveMessage("⚠️ Server connected but no model loaded");
        } else {
          // Full success
          setSaveMessage("✓ " + data.message);
        }
        setTimeout(() => setSaveMessage(""), 5000);
      } else {
        setSaveMessage("✗ " + data.error);
        setTimeout(() => setSaveMessage(""), 7000);
      }
    } catch (error) {
      setSaveMessage("✗ Connection failed: Server not reachable");
      setTimeout(() => setSaveMessage(""), 5000);
    }
  };

  const handleTokenChange = (token: string) => {
    setHfToken(token);
    // Auto-save when token is validated
    handleSave();
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-zinc-950/50">
      <header className="border-b border-border/50 glass-strong">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 ring-1 ring-primary/20">
              <SettingsIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Settings</h1>
              <p className="text-sm text-muted-foreground">
                Configure your Continuum experience
              </p>
            </div>
          </div>

          {saveMessage && (
            <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Check className="h-4 w-4" />
              {saveMessage}
            </div>
          )}

          <div className="flex gap-3">
            {activeTab === "general" && (
              <>
                <Button variant="outline" onClick={handleTestConnection}>
                  Test Connection
                </Button>
                <Button onClick={handleSave} className="gap-2">
                  <Save className="h-4 w-4" />
                  Save
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="border-b border-border/50">
        <div className="mx-auto max-w-5xl px-6">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab("general")}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "general"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <SettingsIcon className="h-4 w-4 inline mr-2" />
              General Settings
            </button>
            <button
              onClick={() => setActiveTab("models")}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "models"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Download className="h-4 w-4 inline mr-2" />
              Download Models
            </button>
          </nav>
        </div>
      </div>

      <main className="flex-1 p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {activeTab === "general" ? (
            <>
              <Card className="glass-strong">
                <div className="p-6 space-y-6">
                  <div>
                    <h2 className="mb-4 text-lg font-semibold">
                      Server Configuration
                    </h2>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="model">Model</Label>
                        <Select
                          value={selectedModel}
                          onValueChange={setSelectedModel}
                        >
                          <SelectTrigger className="bg-background/50">
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="atom">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-green-500" />
                                Local (llama.cpp)
                              </div>
                            </SelectItem>
                            <SelectItem value="mistral">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-blue-500" />
                                Mistral API (Cloud)
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Local: Run models on your machine with llama.cpp
                          (private) • Cloud: Use Mistral&apos;s API (requires
                          key)
                        </p>
                      </div>

                      {selectedModel === "atom" && (
                        <div className="space-y-2">
                          <Label htmlFor="serverUrl">
                            llama.cpp Server URL
                          </Label>
                          <Input
                            id="serverUrl"
                            value={serverUrl}
                            onChange={(e) => setServerUrl(e.target.value)}
                            placeholder="http://localhost:8082"
                            className="bg-background/50"
                          />
                          <p className="text-xs text-muted-foreground">
                            URL of your running llama.cpp server (default:
                            http://localhost:8082)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-6">
                    <h2 className="mb-4 text-lg font-semibold">
                      Model Parameters
                    </h2>

                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="temperature">Temperature</Label>
                          <span className="text-sm text-muted-foreground">
                            {temperature[0].toFixed(2)}
                          </span>
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
                          Controls randomness. Lower values produce more
                          deterministic responses.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="maxTokens">Max Tokens</Label>
                          <span className="text-sm text-muted-foreground">
                            {maxTokens[0]}
                          </span>
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
                          <Label htmlFor="streamResponse">
                            Stream Responses
                          </Label>
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
                    <div className="flex items-center gap-2 mb-4">
                      <Palette className="h-5 w-5 text-primary" />
                      <h2 className="text-lg font-semibold">Accent Color</h2>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Choose your preferred accent color for the interface
                    </p>
                    <div className="flex gap-3">
                      {ACCENT_COLORS.map((colorOption) => (
                        <button
                          key={colorOption.id}
                          onClick={() =>
                            setAccentColor(colorOption.id as AccentColor)
                          }
                          className={`group relative flex flex-col items-center gap-2 p-3 rounded-lg transition-all ${
                            accentColor === colorOption.id
                              ? "bg-white/10 ring-2 ring-primary"
                              : "hover:bg-white/5"
                          }`}
                          title={colorOption.description}
                        >
                          <div
                            className={`w-8 h-8 rounded-full transition-transform ${
                              accentColor === colorOption.id
                                ? "scale-110 ring-2 ring-white/30"
                                : "group-hover:scale-105"
                            }`}
                            style={{ backgroundColor: colorOption.color }}
                          />
                          <span className="text-xs font-medium">
                            {colorOption.name}
                          </span>
                          {accentColor === colorOption.id && (
                            <Check className="absolute -top-1 -right-1 h-4 w-4 text-primary bg-background rounded-full" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-6">
                    <h2 className="mb-4 text-lg font-semibold">About</h2>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>Continuum - AI for humans by VANTA Research</p>
                      <p>Designed for clean, professional AI interactions.</p>
                      <p className="mt-4">Version: 0.1.0</p>
                      <p className="mt-4 text-xs">
                        Icons by{" "}
                        <a
                          href="https://www.flaticon.com/uicons"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Flaticon
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* API Keys Card */}
              <Card className="glass-strong">
                <div className="p-6 space-y-6">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">API Keys</h2>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="mistralApiKey">Mistral API Key</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="mistralApiKey"
                            type={showMistralKey ? "text" : "password"}
                            value={mistralApiKey}
                            onChange={(e) => setMistralApiKey(e.target.value)}
                            placeholder="Enter your Mistral API key"
                            className="bg-background/50 pr-10 font-mono text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setShowMistralKey(!showMistralKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showMistralKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Required for using Mistral models. Get your API key from{" "}
                        <a
                          href="https://console.mistral.ai/api-keys/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          console.mistral.ai
                        </a>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Endpoint:{" "}
                        <code className="bg-muted/50 px-1.5 py-0.5 rounded text-xs">
                          https://api.mistral.ai/v1/chat/completions
                        </code>
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <Card className="glass-strong">
              <div className="p-6">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold">Download Models</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Browse and download VANTA Research models directly from
                    HuggingFace. Downloaded models are saved locally and can be
                    used with your llama.cpp server.
                  </p>
                </div>
                <ModelDownloader
                  hfToken={hfToken}
                  onTokenChange={handleTokenChange}
                />
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
