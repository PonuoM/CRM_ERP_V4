<?php
// Common phone utilities for API layer

/**
 * Normalize Thai phone numbers to start with country code '66' (digits only).
 * Handles inputs like '+66...', '66...', '0...', or bare local numbers.
 * - Strips all non-digits
 * - Converts leading '+66' to '66'
 * - Replaces leading '0' with '66'
 * - Ensures no extra '0' immediately after '66'
 */
function normalize_phone_to_66(?string $phone): ?string {
    if ($phone === null) { return null; }
    $trimmed = trim($phone);
    if ($trimmed === '') { return null; }

    // Keep digits only (remove spaces, dashes, parentheses, plus signs, etc.)
    $digits = preg_replace('/\D+/', '', $trimmed);
    if ($digits === null || $digits === '') { return null; }

    // Already starts with 66
    if (strpos($digits, '66') === 0) {
        // If mistakenly has a leading 0 after country code (e.g., 6608...), drop that 0
        if (substr($digits, 2, 1) === '0') {
            $digits = '66' . substr($digits, 3);
        }
        return $digits;
    }

    // Local format starting with 0 -> replace leading 0 with 66
    if ($digits[0] === '0') {
        return '66' . substr($digits, 1);
    }

    // Otherwise, treat as local without leading 0; just prefix 66
    return '66' . $digits;
}

