export function maskRtspUrl(input: string): string {
  try {
    const url = new URL(input);
    if (url.password) {
      url.password = "***";
    }
    return url.toString();
  } catch {
    return input;
  }
}

