export type ApiResponse<T> = {
  success: true;
  data: T;
  meta?: PaginationMeta;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type PaginationMeta = {
  nextCursor: string | null;
  hasNext: boolean;
};
