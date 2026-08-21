import { customFetch } from "./custom-fetch";

export type HelpfulVote = {
  reviewId: string;
  helpful: boolean;
  likeCount: number;
};

export async function setReviewHelpful(reviewId: string, helpful: boolean): Promise<HelpfulVote> {
  return customFetch<HelpfulVote>(`/api/reviews/${encodeURIComponent(reviewId)}/helpful`, {
    method: helpful ? "POST" : "DELETE",
    responseType: "json",
  });
}