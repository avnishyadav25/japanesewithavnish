import { NextResponse } from "next/server";
import { getQuizQuestions } from "@/lib/quiz-data";

export async function GET() {
  const questions = await getQuizQuestions();
  return NextResponse.json({ questions });
}
