
export const load = async ({ params, fetch }) => {
  const platform = params.platform;
  try {
    const res = await fetch(`/api/accounts/${platform}`);
    if (res.ok) {
      const payload = await res.json();
      return { ...payload, platform };
    }
  } catch {
    // ignore and fall through to empty payload
  }
  return {
    platform,
    generatedAt: new Date().toISOString(),
    count: 0,
    accounts: []
  };
};
