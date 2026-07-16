<?php
require 'api/config.php';
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['target_page'] = 'distribution';
$_GET['companyId'] = 1;
require 'api/basket_config.php';
