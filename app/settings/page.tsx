"use client";

import { useState, useEffect, Suspense } from "react";
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
  Globe,
  Server,
  Cpu,
  Cloud,
  ExternalLink,
  Loader2,
  Search,
  ChevronDown,
  ChevronUp,
  List,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import ModelDownloader from "@/components/model-downloader";
import {
  useAccentColor,
  ACCENT_COLORS,
  AccentColor,
} from "@/components/accent-color-provider";

// Provider configuration type
interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  apiKeyField?: string;
  apiKeyPlaceholder?: string;
  apiKeyHelpText?: string;
  apiKeyUrl?: string;
  endpoint?: string;
  isLocal?: boolean;
  requiresCustomEndpoint?: boolean;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "atom",
    name: "Local AI",
    description: "Ollama / llama.cpp",
    icon: <Cpu className="h-4 w-4" />,
    color: "bg-green-500",
    isLocal: true,
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o, GPT-4, GPT-3.5",
    icon: <Cloud className="h-4 w-4" />,
    color: "bg-emerald-500",
    apiKeyField: "openaiApiKey",
    apiKeyPlaceholder: "sk-...",
    apiKeyHelpText: "Get your API key from OpenAI",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    endpoint: "https://api.openai.com/v1/chat/completions",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude 3.5, Claude 3",
    icon: <Cloud className="h-4 w-4" />,
    color: "bg-orange-500",
    apiKeyField: "anthropicApiKey",
    apiKeyPlaceholder: "sk-ant-...",
    apiKeyHelpText: "Get your API key from Anthropic Console",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    endpoint: "https://api.anthropic.com/v1/messages",
  },
  {
    id: "mistral",
    name: "Mistral",
    description: "Mistral Large, Medium, Small",
    icon: <Cloud className="h-4 w-4" />,
    color: "bg-blue-500",
    apiKeyField: "mistralApiKey",
    apiKeyPlaceholder: "...",
    apiKeyHelpText: "Get your API key from Mistral Console",
    apiKeyUrl: "https://console.mistral.ai/api-keys/",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Access 100+ models",
    icon: <Globe className="h-4 w-4" />,
    color: "bg-purple-500",
    apiKeyField: "openrouterApiKey",
    apiKeyPlaceholder: "sk-or-...",
    apiKeyHelpText: "Get your API key from OpenRouter",
    apiKeyUrl: "https://openrouter.ai/keys",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
  },
  {
    id: "custom",
    name: "Custom Endpoint",
    description: "OpenAI-compatible API",
    icon: <Server className="h-4 w-4" />,
    color: "bg-zinc-500",
    requiresCustomEndpoint: true,
  },
];

// Enabled model type
interface EnabledModel {
  id: string;
  name: string;
  provider: string;
}

// Available model from API
interface AvailableModel {
  id: string;
  name: string;
  provider: string;
  description?: string;
}

function SettingsContent() {
  const [serverUrl, setServerUrl] = useState("http://localhost:8082");
  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState([2048]);
  const [streamResponse, setStreamResponse] = useState(true);
  const [selectedModel, setSelectedModel] = useState("atom");
  const [hfToken, setHfToken] = useState("");

  // API Keys
  const [mistralApiKey, setMistralApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [openrouterApiKey, setOpenrouterApiKey] = useState("");

  // Custom endpoint
  const [customEndpointUrl, setCustomEndpointUrl] = useState("");
  const [customEndpointApiKey, setCustomEndpointApiKey] = useState("");
  const [customEndpointModelId, setCustomEndpointModelId] = useState("");

  // Visibility toggles for API keys
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const [saveMessage, setSaveMessage] = useState("");
  const [activeTab, setActiveTab] = useState<
    "general" | "models" | "model-selection"
  >("general");
  const { accentColor, setAccentColor } = useAccentColor();

  // Model selection state
  const [enabledModels, setEnabledModels] = useState<EnabledModel[]>([]);
  const [availableModels, setAvailableModels] = useState<
    Record<string, AvailableModel[]>
  >({});
  const [loadingModels, setLoadingModels] = useState<Record<string, boolean>>(
    {},
  );
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(
    new Set(),
  );

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
            if (data.settings.selectedModel) {
              const providerExists = PROVIDERS.some(
                (p) => p.id === data.settings.selectedModel,
              );
              setSelectedModel(
                providerExists ? data.settings.selectedModel : "atom",
              );
            }
            if (data.settings.hfToken) setHfToken(data.settings.hfToken);
            if (data.settings.mistralApiKey)
              setMistralApiKey(data.settings.mistralApiKey);
            if (data.settings.openaiApiKey)
              setOpenaiApiKey(data.settings.openaiApiKey);
            if (data.settings.anthropicApiKey)
              setAnthropicApiKey(data.settings.anthropicApiKey);
            if (data.settings.openrouterApiKey)
              setOpenrouterApiKey(data.settings.openrouterApiKey);
            if (data.settings.customEndpointUrl)
              setCustomEndpointUrl(data.settings.customEndpointUrl);
            if (data.settings.customEndpointApiKey)
              setCustomEndpointApiKey(data.settings.customEndpointApiKey);
            if (data.settings.customEndpointModelId)
              setCustomEndpointModelId(data.settings.customEndpointModelId);
            if (data.settings.enabledModels)
              setEnabledModels(data.settings.enabledModels);
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
          openaiApiKey,
          anthropicApiKey,
          openrouterApiKey,
          customEndpointUrl,
          customEndpointApiKey,
          customEndpointModelId,
          enabledModels,
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
          setSaveMessage("⚠️ Server connected but no model loaded");
        } else {
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
    handleSave();
  };

  const toggleKeyVisibility = (keyId: string) => {
    setShowKeys((prev) => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const getApiKeyValue = (fieldName: string): string => {
    switch (fieldName) {
      case "openaiApiKey":
        return openaiApiKey;
      case "anthropicApiKey":
        return anthropicApiKey;
      case "mistralApiKey":
        return mistralApiKey;
      case "openrouterApiKey":
        return openrouterApiKey;
      default:
        return "";
    }
  };

  const setApiKeyValue = (fieldName: string, value: string) => {
    switch (fieldName) {
      case "openaiApiKey":
        setOpenaiApiKey(value);
        break;
      case "anthropicApiKey":
        setAnthropicApiKey(value);
        break;
      case "mistralApiKey":
        setMistralApiKey(value);
        break;
      case "openrouterApiKey":
        setOpenrouterApiKey(value);
        break;
    }
  };

  const selectedProvider = PROVIDERS.find((p) => p.id === selectedModel);

  // Fetch available models for a provider
  const fetchModelsForProvider = async (providerId: string) => {
    setLoadingModels((prev) => ({ ...prev, [providerId]: true }));
    try {
      const response = await fetch(`/api/models/${providerId}`);
      const data = await response.json();
      if (data.success && data.models) {
        setAvailableModels((prev) => ({ ...prev, [providerId]: data.models }));
      }
    } catch (error) {
      console.error(`Error fetching ${providerId} models:`, error);
    } finally {
      setLoadingModels((prev) => ({ ...prev, [providerId]: false }));
    }
  };

  // Toggle provider expansion and fetch models if needed
  const toggleProviderExpanded = (providerId: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(providerId)) {
        next.delete(providerId);
      } else {
        next.add(providerId);
        // Fetch models if not already loaded
        if (!availableModels[providerId]) {
          fetchModelsForProvider(providerId);
        }
      }
      return next;
    });
  };

  // Check if a model is enabled
  const isModelEnabled = (modelId: string) => {
    return enabledModels.some((m) => m.id === modelId);
  };

  // Toggle model enabled/disabled
  const toggleModelEnabled = (model: AvailableModel) => {
    setEnabledModels((prev) => {
      const exists = prev.some((m) => m.id === model.id);
      if (exists) {
        return prev.filter((m) => m.id !== model.id);
      } else {
        return [
          ...prev,
          { id: model.id, name: model.name, provider: model.provider },
        ];
      }
    });
  };

  // Filter models by search query
  const filterModels = (models: AvailableModel[]) => {
    if (!modelSearchQuery) return models;
    const query = modelSearchQuery.toLowerCase();
    return models.filter(
      (m) =>
        m.id.toLowerCase().includes(query) ||
        m.name.toLowerCase().includes(query),
    );
  };

  // Get provider color class
  const getProviderColor = (providerId: string) => {
    const provider = PROVIDERS.find((p) => p.id === providerId);
    return provider?.color || "bg-zinc-500";
  };

  // Check if provider has API key configured
  const hasApiKeyConfigured = (providerId: string) => {
    switch (providerId) {
      case "openai":
        return !!openaiApiKey;
      case "anthropic":
        return !!anthropicApiKey;
      case "mistral":
        return !!mistralApiKey;
      case "openrouter":
        return !!openrouterApiKey;
      default:
        return false;
    }
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
            {(activeTab === "general" || activeTab === "model-selection") && (
              <>
                {activeTab === "general" && selectedModel === "atom" && (
                  <Button variant="outline" onClick={handleTestConnection}>
                    Test Connection
                  </Button>
                )}
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
              onClick={() => setActiveTab("model-selection")}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "model-selection"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-4 w-4 inline mr-2" />
              Model Selection
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
              {/* Provider Selection Card */}
              <Card className="glass-strong">
                <div className="p-6 space-y-6">
                  <div>
                    <h2 className="mb-4 text-lg font-semibold">AI Provider</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Choose your preferred AI provider. Local options run on
                      your machine, cloud providers require API keys.
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {PROVIDERS.map((provider) => (
                        <button
                          key={provider.id}
                          onClick={() => setSelectedModel(provider.id)}
                          className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                            selectedModel === provider.id
                              ? "border-primary bg-primary/10"
                              : "border-border/50 hover:border-border hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={`h-2 w-2 rounded-full ${provider.color}`}
                            />
                            <span className="font-medium">{provider.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {provider.description}
                          </p>
                          {selectedModel === provider.id && (
                            <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Provider-specific configuration */}
                  {selectedProvider?.isLocal && (
                    <div className="border-t border-border/50 pt-6 space-y-4">
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <p className="text-sm text-green-400">
                          <strong>Auto-detection:</strong> Continuum will
                          automatically detect and use Ollama (localhost:11434)
                          or llama.cpp (localhost:8082).
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="serverUrl">
                          llama.cpp Server URL (Optional)
                        </Label>
                        <Input
                          id="serverUrl"
                          value={serverUrl}
                          onChange={(e) => setServerUrl(e.target.value)}
                          placeholder="http://localhost:8082"
                          className="bg-background/50"
                        />
                        <p className="text-xs text-muted-foreground">
                          Only needed if using llama.cpp on a custom port/host.
                          Ollama uses default port 11434.
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedProvider?.requiresCustomEndpoint && (
                    <div className="border-t border-border/50 pt-6 space-y-4">
                      <div className="p-3 rounded-lg bg-zinc-500/10 border border-zinc-500/20">
                        <p className="text-sm text-zinc-400">
                          <strong>Custom Endpoint:</strong> Connect to any
                          OpenAI-compatible API (e.g., vLLM,
                          text-generation-inference, LocalAI, or self-hosted
                          models).
                        </p>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="customEndpointUrl">
                            API Endpoint URL
                          </Label>
                          <Input
                            id="customEndpointUrl"
                            value={customEndpointUrl}
                            onChange={(e) =>
                              setCustomEndpointUrl(e.target.value)
                            }
                            placeholder="https://your-api.example.com/v1/chat/completions"
                            className="bg-background/50 font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            The full URL to the chat completions endpoint
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="customEndpointModelId">
                            Model ID
                          </Label>
                          <Input
                            id="customEndpointModelId"
                            value={customEndpointModelId}
                            onChange={(e) =>
                              setCustomEndpointModelId(e.target.value)
                            }
                            placeholder="gpt-4, llama-3-70b, etc."
                            className="bg-background/50 font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            The model identifier to use in API requests
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="customEndpointApiKey">
                            API Key (Optional)
                          </Label>
                          <div className="relative">
                            <Input
                              id="customEndpointApiKey"
                              type={showKeys["custom"] ? "text" : "password"}
                              value={customEndpointApiKey}
                              onChange={(e) =>
                                setCustomEndpointApiKey(e.target.value)
                              }
                              placeholder="Leave empty if not required"
                              className="bg-background/50 pr-10 font-mono text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => toggleKeyVisibility("custom")}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showKeys["custom"] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Model Parameters Card */}
              <Card className="glass-strong">
                <div className="p-6 space-y-6">
                  <h2 className="text-lg font-semibold">Model Parameters</h2>

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
              </Card>

              {/* Accent Color Card */}
              <Card className="glass-strong">
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Palette className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Accent Color</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
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
              </Card>

              {/* API Keys Card */}
              <Card className="glass-strong">
                <div className="p-6 space-y-6">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">API Keys</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Configure API keys for cloud providers. Keys are stored
                    locally and never sent to third parties.
                  </p>

                  <div className="space-y-6">
                    {PROVIDERS.filter(
                      (p) =>
                        p.apiKeyField &&
                        !p.isLocal &&
                        !p.requiresCustomEndpoint,
                    ).map((provider) => (
                      <div key={provider.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${provider.color}`}
                          />
                          <Label htmlFor={provider.apiKeyField}>
                            {provider.name} API Key
                          </Label>
                          {getApiKeyValue(provider.apiKeyField!) && (
                            <span className="text-xs text-green-500 bg-green-500/10 px-2 py-0.5 rounded">
                              Configured
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              id={provider.apiKeyField}
                              type={showKeys[provider.id] ? "text" : "password"}
                              value={getApiKeyValue(provider.apiKeyField!)}
                              onChange={(e) =>
                                setApiKeyValue(
                                  provider.apiKeyField!,
                                  e.target.value,
                                )
                              }
                              placeholder={provider.apiKeyPlaceholder}
                              className="bg-background/50 pr-10 font-mono text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => toggleKeyVisibility(provider.id)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showKeys[provider.id] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            {provider.apiKeyHelpText}
                          </p>
                          {provider.apiKeyUrl && (
                            <a
                              href={provider.apiKeyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              Get API Key
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        {provider.endpoint && (
                          <p className="text-xs text-muted-foreground">
                            Endpoint:{" "}
                            <code className="bg-muted/50 px-1.5 py-0.5 rounded text-xs">
                              {provider.endpoint}
                            </code>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* About Card */}
              <Card className="glass-strong">
                <div className="p-6">
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
              </Card>
            </>
          ) : activeTab === "model-selection" ? (
            <>
              {/* Model Selection Card */}
              <Card className="glass-strong">
                <div className="p-6 space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Select Models for Chat
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Choose which models appear in your chat dropdown. Only
                      models from providers with configured API keys will be
                      available.
                    </p>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search models..."
                      value={modelSearchQuery}
                      onChange={(e) => setModelSearchQuery(e.target.value)}
                      className="pl-10 bg-background/50"
                    />
                  </div>

                  {/* Selected models count */}
                  {enabledModels.length > 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <Check className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">
                        {enabledModels.length} model
                        {enabledModels.length !== 1 ? "s" : ""} selected
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto text-xs"
                        onClick={() => setEnabledModels([])}
                      >
                        Clear all
                      </Button>
                    </div>
                  )}

                  {/* Provider sections */}
                  <div className="space-y-3">
                    {PROVIDERS.filter(
                      (p) =>
                        p.apiKeyField &&
                        !p.isLocal &&
                        !p.requiresCustomEndpoint,
                    ).map((provider) => {
                      const isConfigured = hasApiKeyConfigured(provider.id);
                      const isExpanded = expandedProviders.has(provider.id);
                      const models = availableModels[provider.id] || [];
                      const filteredModels = filterModels(models);
                      const isLoading = loadingModels[provider.id];
                      const enabledCount = enabledModels.filter(
                        (m) => m.provider === provider.id,
                      ).length;

                      return (
                        <Card
                          key={provider.id}
                          className="bg-background/50 overflow-hidden"
                        >
                          <button
                            onClick={() =>
                              isConfigured &&
                              toggleProviderExpanded(provider.id)
                            }
                            disabled={!isConfigured}
                            className={`w-full p-4 flex items-center justify-between text-left transition-colors ${
                              isConfigured
                                ? "hover:bg-muted/50"
                                : "opacity-50 cursor-not-allowed"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`h-3 w-3 rounded-full ${provider.color}`}
                              />
                              <div>
                                <span className="font-medium">
                                  {provider.name}
                                </span>
                                {!isConfigured && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    (API key not configured)
                                  </span>
                                )}
                                {enabledCount > 0 && (
                                  <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                                    {enabledCount} selected
                                  </span>
                                )}
                              </div>
                            </div>
                            {isConfigured &&
                              (isExpanded ? (
                                <ChevronUp className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              ))}
                          </button>

                          {isExpanded && isConfigured && (
                            <div className="border-t border-border/50 p-4">
                              {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                  <span className="ml-2 text-sm text-muted-foreground">
                                    Loading models...
                                  </span>
                                </div>
                              ) : filteredModels.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                  {modelSearchQuery
                                    ? "No models match your search"
                                    : "No models available"}
                                </div>
                              ) : (
                                <div className="space-y-1 max-h-80 overflow-y-auto">
                                  {filteredModels.map((model, index) => (
                                    <label
                                      key={`${model.id}-${index}`}
                                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isModelEnabled(model.id)}
                                        onChange={() =>
                                          toggleModelEnabled(model)
                                        }
                                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm truncate">
                                          {model.name}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate">
                                          {model.id}
                                        </div>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>

                  {/* Save reminder */}
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-sm text-muted-foreground">
                      Remember to click <strong>Save</strong> to apply your
                      model selection to the chat dropdown.
                    </p>
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

export default function Settings() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          Loading settings...
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
