const KEY = "skipcam-onboarded-v1";

export function hasCompletedOnboarding() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(KEY) === "1";
}

export function completeOnboarding() {
  localStorage.setItem(KEY, "1");
}
