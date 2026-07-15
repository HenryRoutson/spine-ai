// AI : shared voice/text feedback shapes — pipeline human-review steps and assistant chat.

export type FeedbackInputMode = "text" | "voice" | "both";

export type feedback_text_string = string;
export type feedback_transcript_string = string;
export type message_id_string = string;

export type UserFeedbackPayload = {
  mode: "text" | "voice";
  text: feedback_text_string;
  transcript?: feedback_transcript_string;
  at: number;
};

export type HumanReviewDecision = {
  decision: "approved" | "rejected";
  feedback?: UserFeedbackPayload;
};

export const FEEDBACK_INPUT_MODES: { value: FeedbackInputMode; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "voice", label: "Voice" },
  { value: "both", label: "Text or voice" },
];

export function feedbackModeAllowsText(mode: FeedbackInputMode | undefined): boolean {
  return mode === "text" || mode === "both";
}

export function feedbackModeAllowsVoice(mode: FeedbackInputMode | undefined): boolean {
  return mode === "voice" || mode === "both";
}

export function isFeedbackPayloadComplete(
  payload: UserFeedbackPayload | undefined,
  required: boolean,
): boolean {
  if (!required) return true;
  return !!payload?.text.trim();
}
