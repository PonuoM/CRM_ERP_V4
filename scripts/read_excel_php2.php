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
        $headers = [];
        $firstRowData = [];
        $rowCount = 0;
        foreach ($xml->sheetData->row as $row) {
            foreach ($row->c as $cell) {
                $val = (string)$cell->v;
                $type = (string)$cell['t'];
                if ($type == 's' && isset($strings[$val])) {
                    $val = $strings[$val];
                } elseif ($type == 'inlineStr' && isset($cell->is->t)) {
                    $val = (string)$cell->is->t;
                }
                if ($rowCount == 0) {
                    $headers[] = $val;
                } else if ($rowCount == 1) {
                    $firstRowData[] = $val;
                }
            }
            $rowCount++;
            if ($rowCount >= 2) break;
        }
        
        $output = "HEADERS:\n";
        foreach ($headers as $i => $h) {
            $output .= "[$i] " . str_replace("\n", " ", $h) . "\n";
        }
        $output .= "\nDATA:\n";
        foreach ($firstRowData as $i => $d) {
            $output .= "[$i] " . str_replace("\n", " ", $d) . "\n";
        }
        file_put_contents("C:/laragon/www/CRM_ERP_V4/tmp_jst_headers.txt", $output);
    }
    $zip->close();
}
