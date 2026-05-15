<?php
$zip = new ZipArchive;
if ($zip->open("C:/laragon/www/CRM_ERP_V4/AllLiteDetailOrder20260515122631514.xlsx") === TRUE) {
    $sharedStringsData = $zip->getFromName('xl/sharedStrings.xml');
    $strings = [];
    if ($sharedStringsData) {
        $xml = simplexml_load_string($sharedStringsData);
        foreach ($xml->si as $val) {
            if (isset($val->t)) {
                $strings[] = (string)$val->t;
            } elseif (isset($val->r)) {
                $text = '';
                foreach ($val->r as $run) {
                    $text .= (string)$run->t;
                }
                $strings[] = $text;
            }
        }
    }
    
    $sheetData = $zip->getFromName('xl/worksheets/sheet1.xml');
    if ($sheetData) {
        $xml = simplexml_load_string($sheetData);
        $rowCount = 0;
        foreach ($xml->sheetData->row as $row) {
            echo "Row $rowCount:\n";
            foreach ($row->c as $cell) {
                $val = (string)$cell->v;
                $type = (string)$cell['t'];
                if ($type == 's' && isset($strings[$val])) {
                    $val = $strings[$val];
                } elseif ($type == 'inlineStr' && isset($cell->is->t)) {
                    $val = (string)$cell->is->t;
                }
                echo "- " . $val . "\n";
            }
            $rowCount++;
            if ($rowCount >= 2) break; // First row is headers, second is data
        }
    }
    $zip->close();
} else {
    echo "Failed to open zip\n";
}
