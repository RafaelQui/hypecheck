/**
 * Re-exports all Zod validator schemas from the generated api.ts.
 *
 * This file exists because `src/index.ts` cannot use `export * from
 * "./generated/api"` alongside `export * from "./generated/types"` — orval
 * names the path-param Zod schema for getProductReviews the same as the
 * TypeScript query-params type (`GetProductReviewsParams`), which causes a
 * TS2308 ambiguity error when both are wildcard-re-exported from index.ts.
 *
 * Here we re-export the path-param schema under a distinct name so
 * downstream callers can import it without colliding with the TS type.
 */
export {
  HealthCheckResponse,
  authSignupBodyPasswordMin,
  AuthSignupBody,
  AuthSignupResponse,
  authLoginBodyPasswordMin,
  AuthLoginBody,
  AuthLoginResponse,
  AuthMeResponse,
  GetWantsResponse,
  SaveWantBody,
  SaveWantResponse,
  RemoveWantQueryParams,
  RemoveWantResponse,
  listProductsQueryLimitDefault,
  listProductsQueryLimitMax,
  listProductsQueryOffsetDefault,
  listProductsQueryOffsetMin,
  ListProductsQueryParams,
  ListProductsResponse,
  GetProductParams,
  GetProductResponse,
  // Rename the path-param schema to avoid collision with the TS query-params
  // type of the same name exported from generated/types.
  GetProductReviewsParams as GetProductReviewsPathParams,
  getProductReviewsQueryLimitDefault,
  getProductReviewsQueryLimitMax,
  getProductReviewsQueryOffsetDefault,
  getProductReviewsQueryOffsetMin,
  GetProductReviewsQueryParams,
  getProductReviewsResponseItemsItemRatingMax,
  GetProductReviewsResponse,
  createReviewBodyRatingMax,
  CreateReviewBody,
  createReviewResponseRatingMax,
  CreateReviewResponse,
  GetProfileResponse,
  getProfileReviewsQueryLimitDefault,
  getProfileReviewsQueryLimitMax,
  getProfileReviewsQueryOffsetDefault,
  getProfileReviewsQueryOffsetMin,
  GetProfileReviewsQueryParams,
  getProfileReviewsResponseItemsItemRatingMax,
  GetProfileReviewsResponse,
  GetUploadUrlBody,
  GetUploadUrlResponse,
} from "./generated/api";
