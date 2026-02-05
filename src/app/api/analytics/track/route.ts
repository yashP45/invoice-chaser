import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRequestIp } from "@/lib/utils/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path, referrer, userAgent, sessionId } = body;

    if (!path) {
      return NextResponse.json({ error: "Path is required" }, { status: 400 });
    }

    // Get user if authenticated
    const supabase = await createServerSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    // Get IP address
    const ip = getRequestIp(request);

    // Parse user agent (simple parsing)
    const deviceInfo = parseUserAgent(userAgent || "");

    // Get location from IP (optional - you can use a service like ipapi.co or similar)
    // For now, we'll skip geolocation to keep it simple and privacy-focused

    // Insert visitor event
    const { error } = await supabase.from("visitor_events").insert({
      path,
      referrer: referrer || null,
      user_agent: userAgent || null,
      ip_address: ip || null,
      device_type: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      session_id: sessionId || null,
      user_id: user?.id || null
    });

    if (error) {
      console.error("Error tracking visitor:", error);
      return NextResponse.json({ error: "Failed to track visit" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in track route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function parseUserAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();
  let deviceType = "desktop";
  let browser = "unknown";
  let os = "unknown";

  // Device type
  if (ua.includes("mobile") || ua.includes("android")) {
    deviceType = "mobile";
  } else if (ua.includes("tablet") || ua.includes("ipad")) {
    deviceType = "tablet";
  }

  // Browser
  if (ua.includes("chrome") && !ua.includes("edg")) {
    browser = "chrome";
  } else if (ua.includes("firefox")) {
    browser = "firefox";
  } else if (ua.includes("safari") && !ua.includes("chrome")) {
    browser = "safari";
  } else if (ua.includes("edg")) {
    browser = "edge";
  } else if (ua.includes("opera") || ua.includes("opr")) {
    browser = "opera";
  }

  // OS
  if (ua.includes("windows")) {
    os = "windows";
  } else if (ua.includes("mac")) {
    os = "macos";
  } else if (ua.includes("linux")) {
    os = "linux";
  } else if (ua.includes("android")) {
    os = "android";
  } else if (ua.includes("ios") || ua.includes("iphone") || ua.includes("ipad")) {
    os = "ios";
  }

  return { deviceType, browser, os };
}
