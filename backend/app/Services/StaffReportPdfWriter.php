<?php

namespace App\Services;

/** A bounded-memory, paginated A4 report writer for large Staff exports. */
class StaffReportPdfWriter
{
    private array $pages = [];
    private array $commands = [];
    private array $tableHeaders = [];
    private float $y = 780;

    public function __construct(private readonly string $title, private readonly string $period)
    {
    }

    public function heading(string $value): void
    {
        $this->ensureSpace(22);
        $this->drawText(strtoupper($value), 40, $this->y, 10, true);
        $this->y -= 17;
    }

    public function text(string $value): void
    {
        foreach ($this->wrap($value, 110) as $line) {
            $this->ensureSpace(12);
            $this->drawText($line, 40, $this->y, 8);
            $this->y -= 11;
        }
    }

    public function blank(): void
    {
        $this->ensureSpace(10);
        $this->y -= 8;
    }

    public function startTable(array $headers): void
    {
        $this->tableHeaders = $headers;
        $this->drawTableHeader();
    }

    public function row(array $values): void
    {
        $count = count($this->tableHeaders);
        if (!$count) return;
        $width = 515 / $count;
        $limit = max(6, (int) floor(($width - 6) / 3.5));
        $cells = array_map(fn ($value) => $this->wrap((string) ($value ?? ''), $limit), $values);
        $height = max(20, 8 + max(array_map('count', $cells)) * 9);
        if ($this->y - $height < 42) {
            $this->finishPage();
            $this->drawTableHeader();
        }
        $this->commands[] = '0.82 G 0.25 w 40 '.($this->y - $height).' 515 '.$height.' re S';
        for ($column = 1; $column < $count; $column++) {
            $x = 40 + $column * $width;
            $this->commands[] = "$x $this->y m $x ".($this->y - $height).' l S';
        }
        foreach ($cells as $column => $lines) {
            foreach ($lines as $index => $line) {
                $rightAligned = count($lines) === 1 && is_numeric(str_replace(',', '', $line));
                $x = $rightAligned ? 40 + ($column + 1) * $width - 3 - mb_strlen($line) * 3.5 : 43 + $column * $width;
                $this->drawText($line, $x, $this->y - 11 - $index * 9, 7);
            }
        }
        $this->y -= $height;
    }

    public function endTable(): void
    {
        $this->tableHeaders = [];
        $this->blank();
    }

    public function output(): string
    {
        $this->finishPage();
        $pageCount = count($this->pages);
        $pdf = "%PDF-1.4\n";
        $offsets = [0];
        $write = function (int $id, string $body) use (&$pdf, &$offsets): void {
            $offsets[$id] = strlen($pdf);
            $pdf .= "$id 0 obj\n$body\nendobj\n";
        };
        $kids = implode(' ', array_map(fn ($index) => (5 + $index * 2).' 0 R', range(0, $pageCount - 1)));
        $write(1, '<< /Type /Catalog /Pages 2 0 R >>');
        $write(2, "<< /Type /Pages /Kids [$kids] /Count $pageCount >>");
        $write(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
        $write(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
        foreach ($this->pages as $index => $content) {
            $pageId = 5 + $index * 2;
            $contentId = $pageId + 1;
            $stream = $this->pageHeader($index + 1, $pageCount)."\n".$content;
            $write($pageId, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents $contentId 0 R >>");
            $write($contentId, '<< /Length '.strlen($stream)." >>\nstream\n$stream\nendstream");
        }
        $xref = strlen($pdf);
        $size = 5 + $pageCount * 2;
        $pdf .= "xref\n0 $size\n0000000000 65535 f \n";
        for ($id = 1; $id < $size; $id++) $pdf .= sprintf('%010d 00000 n ', $offsets[$id])."\n";
        return $pdf."trailer\n<< /Size $size /Root 1 0 R >>\nstartxref\n$xref\n%%EOF";
    }

    private function drawTableHeader(): void
    {
        if (!$this->tableHeaders) return;
        $width = 515 / count($this->tableHeaders);
        $limit = max(6, (int) floor(($width - 6) / 3.5));
        $cells = array_map(fn ($header) => $this->wrap($header, $limit), $this->tableHeaders);
        $height = max(22, 8 + max(array_map('count', $cells)) * 9);
        if ($this->y - $height < 42) $this->finishPage();
        $this->commands[] = '0.96 g 40 '.($this->y - $height).' 515 '.$height.' re f 0 g';
        $this->commands[] = '0.65 G 0.4 w 40 '.($this->y - $height).' 515 '.$height.' re S';
        foreach ($cells as $column => $lines) {
            foreach ($lines as $index => $line) $this->drawText($line, 43 + $column * $width, $this->y - 11 - $index * 9, 7, true);
        }
        $this->y -= $height;
    }

    private function pageHeader(int $page, int $total): string
    {
        $brand = $this->escape('PAWSITIVECARE - THE FUR CLUB PET STATION');
        $title = $this->escape($this->title.'  |  '.$this->period);
        return "1 g 0 0 595 842 re f 0 g\nBT /F2 11 Tf 40 818 Td ($brand) Tj ET\nBT /F1 8 Tf 40 802 Td ($title) Tj ET\n0 G 0.5 w 40 794 m 555 794 l S\nBT /F1 8 Tf 470 22 Td (Page $page of $total) Tj ET";
    }

    private function ensureSpace(float $height): void
    {
        if ($this->y - $height < 42) {
            $this->finishPage();
            if ($this->tableHeaders) $this->drawTableHeader();
        }
    }

    private function drawText(string $value, float $x, float $y, int $size, bool $bold = false): void
    {
        $font = $bold ? 'F2' : 'F1';
        $this->commands[] = '0 g BT /'.$font." $size Tf $x $y Td (".$this->escape($value).') Tj ET';
    }

    private function finishPage(): void
    {
        if (!$this->commands && $this->pages) return;
        $this->pages[] = implode("\n", $this->commands);
        $this->commands = [];
        $this->y = 780;
    }

    private function escape(string $value): string
    {
        $encoded = iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $value) ?: '';
        return str_replace(['\\', '(', ')', "\r", "\n"], ['\\\\', '\\(', '\\)', ' ', ' '], $encoded);
    }

    private function wrap(string $value, int $limit): array
    {
        $words = preg_split('/\s+/', trim($value)) ?: [];
        $lines = [];
        $line = '';
        foreach ($words as $word) {
            if (mb_strlen($line.' '.$word) > $limit && $line !== '') {
                $lines[] = $line;
                $line = '';
            }
            while (mb_strlen($word) > $limit) {
                $lines[] = mb_substr($word, 0, $limit);
                $word = mb_substr($word, $limit);
            }
            $line = $line === '' ? $word : $line.' '.$word;
        }
        if ($line !== '') $lines[] = $line;
        return $lines ?: [''];
    }
}
