import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  generatePKCE,
  generateState,
  buildAuthorizationUrl,
  type OAuthState,
} from "@/lib/chatgpt-auth";

// Store OAuth state temporarily (in production, use a proper session store)
const OAUTH_STATE_FILE = path.join(process.cwd(), "data", "oauth-state.json");

function ensureDataDir() {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function saveOAuthState(oauthState: OAuthState): void {
  ensureDataDir();
  fs.writeFileSync(OAUTH_STATE_FILE, JSON.stringify(oauthState), "utf-8");
}

/**
 * GET /api/auth/chatgpt/start
 *
 * Initiates the ChatGPT OAuth flow:
 * 1. Generates PKCE verifier and challenge
 * 2. Generates state for CSRF protection
 * 3. Stores state temporarily for validation on callback
 * 4. Returns the authorization URL
 */
export async function GET(request: NextRequest) {
  try {
    // Generate PKCE pair
    const pkce = generatePKCE();

    // Generate state for CSRF protection
    const state = generateState();

    // Build the redirect URI from the request
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const redirectUri = `${baseUrl}/api/auth/chatgpt/callback`;

    // Build authorization URL
    const authUrl = buildAuthorizationUrl(pkce, state, redirectUri);

    // Store OAuth state for validation on callback
    const oauthState: OAuthState = {
      state,
      verifier: pkce.verifier,
      createdAt: Date.now(),
    };
    saveOAuthState(oauthState);

    // Return the authorization URL
    return NextResponse.json({
      success: true,
      authUrl,
      state,
    });
  } catch (error) {
    console.error("[ChatGPT Auth] Failed to start OAuth flow:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to initiate authentication",
      },
      { status: 500 }
    );
  }
}
