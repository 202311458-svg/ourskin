export type PrintHtmlDocumentInput = {
  title: string
  subtitle?: string
  headers: string[]
  rows: Array<Array<string | number | null | undefined>>
  emptyMessage?: string
  generatedLabel?: string
  orientation?: "portrait" | "landscape"
}

const escapeHtml = (value: unknown) => {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export function printHtmlDocument({
  title,
  subtitle,
  headers,
  rows,
  emptyMessage = "No records found.",
  generatedLabel = "Generated from OurSkin Staff Portal",
  orientation = "landscape",
}: PrintHtmlDocumentInput) {
  if (typeof window === "undefined") return

  const printWindow = window.open("", "_blank", "width=1200,height=800")

  if (!printWindow) {
    window.alert("Please allow pop-ups so the print view can open.")
    return
  }

  const generatedAt = new Date().toLocaleString("en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

  const pageWidth = orientation === "landscape" ? "297mm" : "210mm"
  const pageHeight = orientation === "landscape" ? "210mm" : "297mm"
  const pageSize = orientation === "landscape" ? "A4 landscape" : "A4 portrait"
  const recordLabel = rows.length === 1 ? "1 record" : `${rows.length} records`

  const headerHtml = headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("")

  const bodyHtml =
    rows.length > 0
      ? rows
          .map(
            (row) => `
              <tr>
                ${row
                  .map((cell) => `<td>${escapeHtml(cell || "Not provided")}</td>`)
                  .join("")}
              </tr>
            `
          )
          .join("")
      : `
        <tr>
          <td colspan="${headers.length}" class="empty">${escapeHtml(emptyMessage)}</td>
        </tr>
      `

  printWindow.document.open()
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          @page {
            size: ${pageSize};
            margin: 9mm;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            min-height: 100%;
          }

          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
            background: #eef2f7;
            padding: 18px;
          }

          .sheet {
            width: ${pageWidth};
            min-height: ${pageHeight};
            margin: 0 auto;
            padding: 12mm;
            background: #ffffff;
            border-radius: 14px;
            box-shadow: 0 18px 50px rgba(15, 23, 42, 0.16);
          }

          .brandBar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
            padding-bottom: 12px;
            border-bottom: 1px solid #d8e0ec;
          }

          .brandName {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            font-weight: 800;
            letter-spacing: 0.02em;
            color: #0f172a;
            text-transform: uppercase;
          }

          .brandMark {
            width: 22px;
            height: 22px;
            border-radius: 999px;
            display: inline-grid;
            place-items: center;
            color: #ffffff;
            background: #0f172a;
            font-size: 12px;
            font-weight: 800;
          }

          .generated {
            text-align: right;
            font-size: 10px;
            line-height: 1.45;
            color: #667085;
          }

          .reportIntro {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 18px;
            align-items: end;
            margin: 14px 0 14px;
          }

          h1 {
            margin: 0;
            font-size: 22px;
            line-height: 1.15;
            letter-spacing: -0.03em;
            color: #0f172a;
          }

          .subtitle {
            margin: 6px 0 0;
            max-width: 185mm;
            font-size: 11px;
            line-height: 1.45;
            color: #475467;
          }

          .recordPill {
            white-space: nowrap;
            border: 1px solid #d8e0ec;
            border-radius: 999px;
            padding: 7px 11px;
            font-size: 11px;
            font-weight: 700;
            color: #344054;
            background: #f8fafc;
          }

          .tableWrap {
            overflow: hidden;
            border: 1px solid #d8e0ec;
            border-radius: 12px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          thead {
            display: table-header-group;
          }

          th {
            background: #f1f5f9;
            color: #101828;
            font-weight: 800;
            text-align: left;
          }

          th,
          td {
            border-right: 1px solid #d8e0ec;
            border-bottom: 1px solid #d8e0ec;
            padding: 7px 7px;
            vertical-align: top;
            font-size: 9.5px;
            line-height: 1.32;
            overflow-wrap: anywhere;
          }

          th:last-child,
          td:last-child {
            border-right: 0;
          }

          tbody tr:nth-child(even) td {
            background: #fbfdff;
          }

          tbody tr:last-child td {
            border-bottom: 0;
          }

          .empty {
            text-align: center;
            padding: 26px;
            color: #667085;
            background: #ffffff;
          }

          .footer {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            margin-top: 10px;
            font-size: 9px;
            line-height: 1.4;
            color: #667085;
          }

          @media print {
            html,
            body {
              width: auto;
              min-height: auto;
              background: #ffffff;
              padding: 0;
            }

            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }

            .sheet {
              width: auto;
              min-height: auto;
              margin: 0;
              padding: 0;
              border-radius: 0;
              box-shadow: none;
            }

            .tableWrap {
              overflow: visible;
            }

            tr {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
        </style>
      </head>

      <body>
        <main class="sheet">
          <section class="brandBar">
            <div class="brandName">
              <span class="brandMark">O</span>
              OurSkin Dermatology Center
            </div>

            <div class="generated">
              <strong>${escapeHtml(generatedLabel)}</strong><br />
              ${escapeHtml(generatedAt)}
            </div>
          </section>

          <section class="reportIntro">
            <div>
              <h1>${escapeHtml(title)}</h1>
              ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ""}
            </div>

            <div class="recordPill">${escapeHtml(recordLabel)}</div>
          </section>

          <section class="tableWrap">
            <table>
              <thead>
                <tr>${headerHtml}</tr>
              </thead>
              <tbody>${bodyHtml}</tbody>
            </table>
          </section>

          <section class="footer">
            <span>This printed copy is intended for staff scheduling and appointment coordination.</span>
            <span>Printed through the OurSkin Staff Portal</span>
          </section>
        </main>
      </body>
    </html>
  `)
  printWindow.document.close()

  window.setTimeout(() => {
    printWindow.focus()
    printWindow.print()
  }, 300)
}
