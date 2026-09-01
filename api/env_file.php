<?php
/**
 * Read KEY=VALUE files. Used by backup_drive.php and the office dump helper.
 * getenv() wins over file values. Never commit the files this reads.
 */

function erp_parse_env_file(string $path): array
{
    if (!is_readable($path)) {
        return [];
    }
    $out = [];
    $lines = @file($path, FILE_IGNORE_NEW_LINES);
    if (!is_array($lines)) {
        return [];
    }
    foreach ($lines as $line) {
        $line = preg_replace('/^[\xef\xbb\xbf]+/', '', $line);
        $line = trim((string) $line);
        if ($line === '' || ($line[0] ?? '') === '#') {
            continue;
        }
        if (stripos($line, 'export ') === 0) {
            $line = trim(substr($line, 7));
        }
        $eq = strpos($line, '=');
        if ($eq === false) {
            continue;
        }
        $k = trim(substr($line, 0, $eq));
        $v = trim(substr($line, $eq + 1));
        $q = $v === '' ? '' : $v[0];
        if (($q === '"' || $q === "'") && substr($v, -1) === $q) {
            $v = substr($v, 1, -1);
        }
        if ($k !== '') {
            $out[$k] = $v;
        }
    }
    return $out;
}

/** Later paths override earlier ones. */
function erp_merge_env_files(array $paths): array
{
    $out = [];
    foreach ($paths as $path) {
        $out = array_merge($out, erp_parse_env_file((string) $path));
    }
    return $out;
}

function erp_env_get(string $name, array $fromFiles): string
{
    $g = getenv($name);
    if (is_string($g) && trim($g) !== '') {
        return trim($g);
    }
    $f = $fromFiles[$name] ?? '';
    return is_string($f) ? trim($f) : '';
}

/** File map with getenv overlay so callers can use an array of all keys. */
function erp_env_overlay_getenv(array $fromFiles): array
{
    $out = $fromFiles;
    foreach (array_keys($out) as $k) {
        $g = getenv($k);
        if (is_string($g) && trim($g) !== '') {
            $out[$k] = trim($g);
        }
    }
    return $out;
}
