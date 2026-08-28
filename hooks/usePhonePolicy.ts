import { useEffect, useState } from "react";
import {
  DEFAULT_PHONE_POLICY,
  fetchPhonePolicy,
  type PhonePolicy,
} from "../services/api";

/**
 * Cached per browser session. The policy only changes when someone edits app_settings or the user
 * signs in as somebody else, so refetching it on every screen would be noise on every navigation.
 */
let cached: PhonePolicy | null = null;
let inFlight: Promise<PhonePolicy> | null = null;

/** Drop the cache — call on sign-out, so the next user does not inherit this one's policy. */
export function resetPhonePolicy(): void {
  cached = null;
  inFlight = null;
}

function load(): Promise<PhonePolicy> {
  if (cached) return Promise.resolve(cached);
  if (!inFlight) {
    inFlight = fetchPhonePolicy().then((p) => {
      cached = p;
      inFlight = null;
      return p;
    });
  }
  return inFlight;
}

/**
 * What this user may see of customer phone numbers.
 *
 * Starts from the permissive default so nothing flickers or disappears while the request is in
 * flight — the server masks the data either way, so an optimistic start cannot leak a number.
 */
export function usePhonePolicy(): PhonePolicy {
  const [policy, setPolicy] = useState<PhonePolicy>(cached ?? DEFAULT_PHONE_POLICY);

  useEffect(() => {
    let alive = true;
    load().then((p) => {
      if (alive) setPolicy(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  return policy;
}

/**
 * Is this value the server's placeholder rather than a real number?
 *
 * For the handful of places that receive a value and have to decide whether to feed it to
 * something that expects digits — a tel: link, a phone formatter, a validator. Prefer
 * `policy.phone_hidden` where the choice is about rendering, and keep this for guarding a call.
 */
export function isMaskedPhone(value: unknown, policy: PhonePolicy): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (v === "") return false;
  if (v === policy.mask) return true;
  // The mask character is the test, not the absence of digits: a partial mask like 08xxxxxx78
  // keeps four real digits and would otherwise be mistaken for a dialable number.
  if (v.toLowerCase().includes(policy.maskChar)) return true;
  return !/\d/.test(v);
}
