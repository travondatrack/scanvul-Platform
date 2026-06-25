import { NextRequest, NextResponse as ServerResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid"; // Needs to be installed, but Prisma uuid() is available on insert.

const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();

export async function POST(req: NextRequest) {
  try {
    // 1. IP Rate Limiting via In-Memory Map
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown-ip";
    
    const now = Date.now();
    const rateLimitData = rateLimitMap.get(ip);
    
    let requests = 1;
    if (rateLimitData) {
      if (now > rateLimitData.expiresAt) {
        // Expired, reset
        requests = 1;
      } else {
        requests = rateLimitData.count + 1;
      }
    }

    rateLimitMap.set(ip, {
      count: requests,
      expiresAt: rateLimitData && now <= rateLimitData.expiresAt ? rateLimitData.expiresAt : now + 3600 * 1000 // 1 hour
    });

    if (requests > 5) {
      return ServerResponse.json(
        { error: "Rate limit exceeded. Maximum 5 guest scans per hour." },
        { status: 429 }
      );
    }

    // 2. Parse request
    const body = await req.json();
    const { sourceType, sourceValue, codeSnippet, language } = body;
    
    const actualSourceType = sourceType || "paste";
    const actualSourceValue = sourceValue || codeSnippet;

    if (!actualSourceValue || typeof actualSourceValue !== "string" || actualSourceValue.length > 500000) {
      return ServerResponse.json(
        { error: "Invalid input. Maximum size is 500KB." },
        { status: 400 }
      );
    }

    // 3. Create a temporary project/scan in Database
    const scan = await prisma.scan.create({
      data: {
        sourceType: actualSourceType,
        sourceValue: actualSourceValue,
        status: "queued",
        languageSummary: JSON.stringify({ [language || "unknown"]: 100 }),
      }
    });

    // 4. Push job to Python FastAPI Worker via HTTP
    const jobData = {
      scan_id: scan.id,
      source_type: actualSourceType,
      source_value: actualSourceValue,
      is_guest: true
    };
    
    try {
      await fetch("http://127.0.0.1:8001/api/v1/scan/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobData)
      });
    } catch (fetchError) {
      console.error("Failed to trigger Python worker via HTTP:", fetchError);
      // We don't fail the request, scan remains queued.
    }

    return ServerResponse.json({
      message: "Scan queued successfully",
      scanId: scan.id,
      remainingQuota: 5 - requests
    });

  } catch (error) {
    console.error("Guest scan error:", error);
    return ServerResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
