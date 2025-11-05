<?php
// Simple server-side proxy to Onecall API to avoid browser CORS/preflight issues
// Routes: /mini_erp/onecall/<path>?<query> -> forwards to https://onecallvoicerecord.dtac.co.th/<path>?<query>

// Hardening: return JSON on errors instead of PHP HTML fatals
error_reporting(E_ALL);
ini_set('display_errors', '0');

function json_error($status, $msg, $extra = []) {
  http_response_code($status);
  header('Content-Type: application/json');
  echo json_encode(array_merge([
    'success' => false,
    'error' => $msg,
  ], $extra));
  exit;
}

if (!function_exists('curl_init')) {
  json_error(500, 'PHP cURL extension is not enabled. Please enable ext/curl in php.ini');
}

// Build destination URL
$path = isset($_GET['path']) ? ltrim($_GET['path'], '/') : '';
$query = $_GET;
unset($query['path']);
$qs = http_build_query($query);
$target = 'https://onecallvoicerecord.dtac.co.th/' . $path . ($qs ? ('?' . $qs) : '');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Basic CORS handling (useful if called cross-origin or for OPTIONS probes)
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
header('Access-Control-Allow-Origin: ' . $origin);
header('Vary: Origin');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Authorization, Content-Type, Accept');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

// Short-circuit preflight
if (strtoupper($method) === 'OPTIONS') {
  http_response_code(204);
  exit;
}

// Read request body
$body = file_get_contents('php://input');

// Collect incoming headers
function get_request_headers() {
  if (function_exists('getallheaders')) {
    return getallheaders();
  }
  $headers = [];
  foreach ($_SERVER as $name => $value) {
    if (substr($name, 0, 5) == 'HTTP_') {
      $key = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))));
      $headers[$key] = $value;
    }
  }
  return $headers;
}

$incoming = get_request_headers();

// Prepare headers to forward
$forwardHeaders = [];
$incomingLower = [];
foreach ($incoming as $k => $v) { $incomingLower[strtolower($k)] = $v; }
foreach (['authorization', 'content-type', 'accept'] as $h) {
  if (isset($incomingLower[$h])) {
    $forwardHeaders[] = ucfirst($h) . ': ' . $incomingLower[$h];
  }
}
// If POST with no body and no Content-Type from client, explicitly clear default cURL Content-Type
$hasContentType = isset($incomingLower['content-type']);
$isEmptyBodyPost = (strtoupper($method) === 'POST' && (string)$body === '');
if ($isEmptyBodyPost && !$hasContentType) {
  $forwardHeaders[] = 'Content-Type:'; // tells cURL to not send a default Content-Type
  $forwardHeaders[] = 'Content-Length: 0';
}

// TLS verification (secure by default). To test issues, you can pass insecure=1 to temporarily disable.
$insecure = isset($_GET['insecure']) && $_GET['insecure'] == '1';

if (function_exists('curl_init')) {
  // cURL path
  $ch = curl_init($target);
  if ($ch === false) {
    json_error(500, 'Failed to initialize cURL', ['target' => $target]);
  }
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_HEADER, true);
  curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
  curl_setopt($ch, CURLOPT_ENCODING, '');
  curl_setopt($ch, CURLOPT_TIMEOUT, 30);

  switch (strtoupper($method)) {
    case 'GET':
      break;
    case 'POST':
      if ($isEmptyBodyPost) {
        // Send POST with no body, no Content-Type
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
      } else {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
      }
      break;
    default:
      curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
      if (!empty($body)) { curl_setopt($ch, CURLOPT_POSTFIELDS, $body); }
  }

  if (!empty($forwardHeaders)) {
    curl_setopt($ch, CURLOPT_HTTPHEADER, $forwardHeaders);
  }

  curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, !$insecure);
  curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, $insecure ? 0 : 2);

  $resp = curl_exec($ch);
  if ($resp === false) {
    $errno = curl_errno($ch);
    $err  = curl_error($ch);
    curl_close($ch);
    json_error(502, 'Upstream request failed: ' . $err, ['curl_errno' => $errno, 'target' => $target]);
  }

  $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
  $rawHeaders = substr($resp, 0, $headerSize);
  $bodyOut = substr($resp, $headerSize);
  curl_close($ch);

  http_response_code($status);
  header('X-Upstream-URL: ' . $target);
  $headerLines = explode("\r\n", trim($rawHeaders));
  $contentType = null;
  foreach ($headerLines as $line) {
    if (stripos($line, 'Content-Type:') === 0) {
      $contentType = trim(substr($line, strlen('Content-Type:')));
      break;
    }
  }
  if ($contentType) { header('Content-Type: ' . $contentType); }
  echo $bodyOut;
} else {
  // Streams fallback (no cURL)
  $headerStr = '';
  foreach ($forwardHeaders as $h) { $headerStr .= $h . "\r\n"; }
  $opts = [
    'http' => [
      'method' => $method,
      'header' => $headerStr,
      'content' => in_array(strtoupper($method), ['POST','PUT','PATCH']) ? ($isEmptyBodyPost ? '' : $body) : null,
      'ignore_errors' => true,
      'timeout' => 30,
    ],
    'ssl' => [
      'verify_peer' => !$insecure,
      'verify_peer_name' => !$insecure,
    ],
  ];
  $ctx = stream_context_create($opts);
  $respBody = @file_get_contents($target, false, $ctx);
  $status = 0; $contentType = null;
  if (isset($http_response_header) && is_array($http_response_header)) {
    foreach ($http_response_header as $i => $line) {
      if ($i === 0) {
        if (preg_match('#HTTP/\S+\s+(\d{3})#', $line, $m)) { $status = (int)$m[1]; }
      } else if (stripos($line, 'Content-Type:') === 0) {
        $contentType = trim(substr($line, strlen('Content-Type:')));
      }
    }
  }
  if ($status === 0) { $status = 502; }
  http_response_code($status);
  header('X-Upstream-URL: ' . $target);
  header('Content-Type: ' . ($contentType ?: 'application/json'));
  if ($respBody === false) {
    echo json_encode(['success' => false, 'error' => 'Upstream request failed (streams)']);
  } else {
    echo $respBody;
  }
}
