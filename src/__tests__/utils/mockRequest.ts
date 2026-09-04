export function createMockRequest(
  url = "http://localhost:3000/api",
  init: RequestInit = {}
): Request {
  const { method = "GET", body, headers = {}, ...rest } = init;
  const finalHeaders = { "Content-Type": "application/json", ...headers };
  const finalInit: RequestInit = {
    method,
    headers: finalHeaders,
    ...rest,
  };
  if (body) {
    finalInit.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  return new Request(url, finalInit);
}

export function createMockRequestWithParams(
  basePath: string,
  id: string,
  init: RequestInit = {}
): Request {
  return createMockRequest(`${basePath}/${id}`, init);
}

export function createFormDataRequest(
  url: string,
  formData: FormData
): Request {
  return new Request(url, {
    method: "POST",
    body: formData,
  });
}
