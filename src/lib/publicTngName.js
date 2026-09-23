export function getPublicTngName(subject, fallback = 'Player') {
  const rawHandle =
    subject?.handle ||
    subject?.normalizedHandle ||
    subject?.normalized_handle ||
    '';

  const handle = String(rawHandle).trim().replace(/^@/, '');
  if (handle) return `@${handle}`;

  const legacyName =
    subject?.playerName ||
    subject?.name ||
    subject?.displayName ||
    subject?.display_name ||
    '';

  return String(legacyName).trim() || fallback;
}

export function getPublicTngHandle(subject) {
  const rawHandle =
    subject?.handle ||
    subject?.normalizedHandle ||
    subject?.normalized_handle ||
    '';

  const handle = String(rawHandle).trim().replace(/^@/, '');
  return handle ? `@${handle}` : '';
}
