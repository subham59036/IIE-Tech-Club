/**
 * GET /api/events/captcha
 * Generates a simple math captcha challenge.
 * Returns { token, question } — the token must be submitted with registration.
 * Answer is stored hashed; token expires in 1 hour (cleaned by cron).
 */

import { NextResponse }    from "next/server";
import { createHash }      from "crypto";
import { v4 as uuid }      from "uuid";
import { dbCaptcha }       from "@/lib/db";
import { generateCaptcha } from "@/lib/utils";

export async function GET() {
  const { question, answer } = generateCaptcha();
  const token                = uuid().replace(/-/g, "");

  const answerHash = createHash("sha256").update(answer).digest("hex");

  await dbCaptcha.execute({
    sql:  "INSERT INTO captcha_tokens (token, answer) VALUES (?,?)",
    args: [token, answerHash],
  });

  return NextResponse.json({ ok: true, data: { token, question } });
}
