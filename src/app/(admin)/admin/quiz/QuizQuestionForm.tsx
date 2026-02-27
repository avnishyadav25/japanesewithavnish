"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";
import { GenerateContentButton } from "@/components/admin/GenerateContentButton";

const JLPT_LEVELS = ["", "N5", "N4", "N3", "N2", "N1"];

type QuizQuestion = {
    id?: string;
    question_text: string;
    options: string[];
    correct_answer: string;
    jlpt_level: string | null;
    sort_order: number;
    explanation: string | null;
};

export function QuizQuestionForm({ question }: { question?: QuizQuestion }) {
    const router = useRouter();
    const [saveStatus, setSaveStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
    const [form, setForm] = useState({
        question_text: question?.question_text ?? "",
        option_a: question?.options?.[0] ?? "",
        option_b: question?.options?.[1] ?? "",
        option_c: question?.options?.[2] ?? "",
        option_d: question?.options?.[3] ?? "",
        correct_answer: question?.correct_answer ?? "A",
        jlpt_level: question?.jlpt_level ?? "",
        sort_order: question?.sort_order ?? 0,
        explanation: question?.explanation ?? "",
    });

    function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
        setForm((f) => ({ ...f, [key]: value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaveStatus("loading");
        try {
            const url = question?.id
                ? `/api/admin/quiz/questions/${question.id}`
                : "/api/admin/quiz/questions";
            const res = await fetch(url, {
                method: question?.id ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question_text: form.question_text,
                    options: [form.option_a, form.option_b, form.option_c, form.option_d].filter(Boolean),
                    correct_answer: form.correct_answer,
                    jlpt_level: form.jlpt_level || null,
                    sort_order: form.sort_order,
                    explanation: form.explanation || null,
                }),
            });
            if (!res.ok) throw new Error("Failed");
            setSaveStatus("success");
            router.push("/admin/quiz");
            router.refresh();
        } catch {
            setSaveStatus("error");
        }
    }

    async function handleDelete() {
        if (!question?.id) return;
        if (!confirm("Delete this question? This cannot be undone.")) return;
        await fetch(`/api/admin/quiz/questions/${question.id}`, { method: "DELETE" });
        router.push("/admin/quiz");
        router.refresh();
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <AdminCard>
                <div className="space-y-4">
                    {/* Question text */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-charcoal">Question</label>
                            <GenerateContentButton
                                contentType="grammar"
                                context={{ topic: form.question_text, jlptLevel: form.jlpt_level || undefined }}
                                onGenerated={(data) => {
                                    const text = typeof data === "string" ? data : (data as { content?: string }).content ?? "";
                                    update("question_text", text.slice(0, 500));
                                }}
                            />
                        </div>
                        <textarea
                            value={form.question_text}
                            onChange={(e) => update("question_text", e.target.value)}
                            required
                            rows={3}
                            placeholder="e.g. 「___は学生です。」— What particle fills the blank?"
                            className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                        />
                    </div>

                    {/* Options */}
                    <div>
                        <label className="block text-sm font-medium text-charcoal mb-2">Answer Options</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(["A", "B", "C", "D"] as const).map((letter) => {
                                const key = `option_${letter.toLowerCase()}` as keyof typeof form;
                                return (
                                    <div key={letter} className="flex items-center gap-2">
                                        <span
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${form.correct_answer === letter
                                                    ? "bg-primary text-white"
                                                    : "bg-[var(--base)] border border-[var(--divider)] text-charcoal"
                                                }`}
                                        >
                                            {letter}
                                        </span>
                                        <input
                                            type="text"
                                            value={form[key] as string}
                                            onChange={(e) => update(key, e.target.value)}
                                            placeholder={`Option ${letter}`}
                                            className="flex-1 px-3 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Correct answer */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-charcoal mb-1">Correct Answer</label>
                            <select
                                value={form.correct_answer}
                                onChange={(e) => update("correct_answer", e.target.value)}
                                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                            >
                                <option value="A">A</option>
                                <option value="B">B</option>
                                <option value="C">C</option>
                                <option value="D">D</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-charcoal mb-1">JLPT Level</label>
                            <select
                                value={form.jlpt_level}
                                onChange={(e) => update("jlpt_level", e.target.value)}
                                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                            >
                                {JLPT_LEVELS.map((l) => (
                                    <option key={l} value={l}>{l || "— All levels —"}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-charcoal mb-1">Sort Order</label>
                            <input
                                type="number"
                                value={form.sort_order}
                                onChange={(e) => update("sort_order", parseInt(e.target.value, 10) || 0)}
                                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                            />
                        </div>
                    </div>

                    {/* Explanation */}
                    <div>
                        <label className="block text-sm font-medium text-charcoal mb-1">
                            Explanation <span className="text-secondary font-normal">(shown after answer)</span>
                        </label>
                        <textarea
                            value={form.explanation}
                            onChange={(e) => update("explanation", e.target.value)}
                            rows={2}
                            placeholder="Why is this the correct answer?"
                            className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm"
                        />
                    </div>
                </div>
            </AdminCard>

            <div className="flex items-center gap-4">
                <button type="submit" className="btn-primary" disabled={saveStatus === "loading"}>
                    {saveStatus === "loading" ? "Saving..." : question?.id ? "Update Question" : "Create Question"}
                </button>
                <a href="/admin/quiz" className="btn-secondary">
                    Cancel
                </a>
                {question?.id && (
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="ml-auto text-sm text-red-600 hover:text-red-800 hover:underline"
                    >
                        Delete question
                    </button>
                )}
                {saveStatus === "error" && (
                    <span className="text-red-600 text-sm">Failed to save. Please try again.</span>
                )}
            </div>
        </form>
    );
}
