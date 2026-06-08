<?php

class JstErpService {
    private $accountId;
    private $password;
    private $cookieFile;
    private $cacheFile;
    private $cacheTtl = 180; // 3 minutes cache

    private $companyId;
    private $pdo;

    public function __construct(PDO $pdo, int $companyId) {
        $this->pdo = $pdo;
        $this->companyId = $companyId;

        $stmt = $pdo->prepare('SELECT setting_key, setting_value FROM company_settings WHERE company_id = ? AND setting_key IN ("JST_ACCOUNT_ID", "JST_PASSWORD")');
        $stmt->execute([$companyId]);
        $settings = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

        $this->accountId = $settings['JST_ACCOUNT_ID'] ?? '';
        $this->password = $settings['JST_PASSWORD'] ?? '';
        
        $cacheDir = __DIR__ . '/../../storage/cache';
        if (!is_dir($cacheDir)) {
            mkdir($cacheDir, 0777, true);
        }
        $this->cookieFile = $cacheDir . '/jst_cookies_comp_' . $companyId . '.json';
        $this->cacheFile = $cacheDir . '/jst_inventory_comp_' . $companyId . '.json';
    }

    private function generateGuid() {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40); 
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80); 
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    private function login() {
        if (empty($this->accountId) || empty($this->password)) {
            throw new \Exception("Missing JST credentials in environment variables.");
        }

        // Public key from JST ERP Login Page
        $publicKeyStr = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoQh0wEqx/R2H1v00IU12Oc30fosRC/frhH89L6G+fzeaqI19MYQhEPMU13wpeqRONCUta+2iC1sgCNQ9qGGf19yGdZUfueaB1Nu9rdueQKXgVurGHJ+5N71UFm+OP1XcnFUCK4wT5d7ZIifXxuqLehP9Ts6sNjhVfa+yU+VjF5HoIe69OJEPo7OxRZcRTe17khc93Ic+PfyqswQJJlY/bgpcLJQnM+QuHmxNtF7/FpAx9YEQsShsGpVo7JaKgLo+s6AFoJ4QldQKir2vbN9vcKRbG3piElPilWDpjXQkOJZhUloh/jd7QrKFimZFldJ1r6Q59QYUyGKZARUe0KZpMQIDAQAB";
        $pemKey = "-----BEGIN PUBLIC KEY-----\n" . wordwrap($publicKeyStr, 64, "\n", true) . "\n-----END PUBLIC KEY-----";

        if (!openssl_public_encrypt($this->password, $encryptedBinary, $pemKey, OPENSSL_PKCS1_PADDING)) {
            throw new \Exception("RSA Encryption failed.");
        }

        // Pad to 256 bytes with nulls
        $paddedBinary = str_pad($encryptedBinary, 256, "\0", STR_PAD_LEFT);
        $finalPasswordPayload = base64_encode($paddedBinary);

        $payload = [
            "accountId" => $this->accountId,
            "password" => $finalPasswordPayload,
            "captchaCode" => "",
            "cacheKey" => $this->generateGuid(),
            "clientIp" => "",
            "address" => "",
            "clientTimeZone" => 7,
            "isNeedCaptcha" => false,
            "redirectUrl" => "https://asia-web.jsterp.com/"
        ];

        $ch = curl_init('https://asia-web.jsterp.com/Org/Account/Login/Login');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json;charset=UTF-8',
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/148.0.0.0 Safari/537.36'
        ]);

        $response = curl_exec($ch);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $headers = substr($response, 0, $headerSize);
        $body = substr($response, $headerSize);
        curl_close($ch);

        $resJson = json_decode($body, true);
        if (isset($resJson['data']['isNeedCaptcha']) && $resJson['data']['isNeedCaptcha'] == true) {
             throw new \Exception("JST Login Failed: Captcha is required.");
        }
        if (isset($resJson['success']) && !$resJson['success']) {
             throw new \Exception("JST Login Failed: " . ($resJson['data']['message'] ?? 'Unknown error'));
        }

        $cookies = [];
        preg_match_all('/^Set-Cookie:\s*([^;]*)/mi', $headers, $matches);
        if (!empty($matches[1])) {
            foreach ($matches[1] as $item) {
                $parts = explode('=', $item, 2);
                if (count($parts) == 2) {
                    $cookies[trim($parts[0])] = trim($parts[1]);
                }
            }
        }

        // Save cookies
        file_put_contents($this->cookieFile, json_encode([
            'cookies' => $cookies,
            'expires' => time() + (12 * 3600) // 12 hours expiry
        ]));

        return $cookies;
    }

    private function getCookies() {
        if (file_exists($this->cookieFile)) {
            $data = json_decode(file_get_contents($this->cookieFile), true);
            if ($data && time() < $data['expires']) {
                return $data['cookies'];
            }
        }
        return $this->login();
    }

    private function buildCookieString($cookies) {
        $str = '';
        foreach ($cookies as $k => $v) {
            $str .= "$k=$v; ";
        }
        return $str;
    }

    private function fetchInventoryPage($cookies, $pageIndex) {
        $payload = [
            "PageIndex" => $pageIndex,
            "PageSize" => 100 // Fetch up to 100 items per page to reduce loops
        ];

        $ch = curl_init('https://asia.jsterp.com/wms/Inventory/GetSkuInventorys');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json;charset=UTF-8',
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/148.0.0.0 Safari/537.36',
            'Cookie: ' . $this->buildCookieString($cookies)
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 401 || $httpCode === 403) {
            throw new \Exception("Unauthorized", 401);
        }

        return json_decode($response, true);
    }

    public function getAllInventory($forceRefresh = false) {
        // 1. Check Short-lived Cache
        if (!$forceRefresh && file_exists($this->cacheFile)) {
            $mtime = filemtime($this->cacheFile);
            if (time() - $mtime < $this->cacheTtl) {
                return json_decode(file_get_contents($this->cacheFile), true);
            }
        }

        $cookies = $this->getCookies();
        $allItems = [];
        $pageIndex = 1;
        $maxPages = 20; // Safety limit
        
        try {
            while ($pageIndex <= $maxPages) {
                $res = $this->fetchInventoryPage($cookies, $pageIndex);
                
                if (empty($res['Data'])) {
                    break;
                }
                
                // Map to DTO format for Frontend
                foreach ($res['Data'] as $item) {
                    $allItems[] = [
                        'skuId' => $item['SkuId'] ?? '',
                        'skuName' => $item['SkuName'] ?? '',
                        'warehouseName' => $item['WarehouseName'] ?? '',
                        'qty' => $item['Qty'] ?? 0,
                        'availableQty' => $item['AvailableQty'] ?? 0,
                        'orderLock' => $item['OrderLock'] ?? 0,
                        'pic' => $item['Pic'] ?? '',
                        'updatedAt' => $item['Modified'] ?? ''
                    ];
                }

                // Check if it's the last page
                if (isset($res['DataPage']['IsLast']) && $res['DataPage']['IsLast'] === true) {
                    break;
                }
                
                // Fallback exit condition
                if (count($res['Data']) < 100) {
                    break;
                }

                $pageIndex++;
            }
        } catch (\Exception $e) {
            if ($e->getCode() === 401) {
                // Token expired, clear cookie and retry ONCE
                if (file_exists($this->cookieFile)) {
                    unlink($this->cookieFile);
                }
                $cookies = $this->login();
                return $this->getAllInventory(true);
            }
            throw $e;
        }

        // 2. Save Cache
        file_put_contents($this->cacheFile, json_encode($allItems));
        
        return $allItems;
    }
}
