import { useState } from 'react';
import { Box, Button, GlobalStyles, Paper, Stack, Typography } from '@mui/material';
import PrintOutlined from '@mui/icons-material/PrintOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import { Link as RouterLink, useSearchParams } from 'react-router';
import {
  buildReport,
  formatDate,
  isReportType,
  isValidRange,
  reportToCsv,
  type ReportDocument,
  type ReportRange,
} from '@elderguard/shared';
import { useCurrentUser } from '../../auth/authContext';
import { useIncidentsBetween, useRooms } from '../../api/queries';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, SkeletonRows } from '../../components/QueryStates';
import { FACILITY_NAME } from '../../layout/facility';
import { NotFoundPage } from '../system/NotFoundPage';

/** Prints only the report, on A4, with page numbers in the bottom margin. */
const printStyles = (
  <GlobalStyles
    styles={{
      '@page': {
        size: 'A4',
        margin: '16mm 14mm 18mm',
        '@bottom-right': {
          content: '"Page " counter(page) " of " counter(pages)',
          fontSize: '9pt',
          fontFamily: 'Inter, sans-serif',
        },
      },
      '@media print': {
        'body *': { visibility: 'hidden' },
        '#report, #report *': { visibility: 'visible' },
        '#report': {
          position: 'absolute',
          inset: '0 auto auto 0',
          width: '100%',
          boxShadow: 'none',
          border: 0,
          padding: 0,
        },
        body: { background: '#fff' },
      },
    }}
  />
);

const day = (date: string) => formatDate(new Date(`${date}T00:00:00`));

function downloadCsv(name: string, csv: string) {
  // The byte order mark makes Excel read the file as UTF-8.
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function ReportBody({
  doc,
  header,
  generatedBy,
  generatedAt,
}: {
  doc: ReportDocument;
  header: [string, string][];
  generatedBy: string;
  generatedAt: Date;
}) {
  return (
    <Paper
      id="report"
      variant="outlined"
      sx={{ p: { xs: 4, md: 10 }, maxWidth: '210mm', mx: 'auto', bgcolor: '#fff', color: '#1a1c1c' }}
    >
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'baseline',
          borderBottom: '2px solid #00696b',
          pb: 3,
        }}
      >
        <Typography sx={{ fontWeight: 600, color: '#00696b' }}>ElderGuard</Typography>
        <Typography variant="body2">{FACILITY_NAME}</Typography>
      </Stack>
      <Typography variant="h5" component="h2" sx={{ mt: 5 }}>
        {doc.title}
      </Typography>
      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'max-content 1fr',
          columnGap: 4,
          rowGap: 1,
          mt: 3,
          fontSize: 14,
          '& dd': { m: 0 },
        }}
      >
        {header.map(([k, v]) => (
          <Box key={k} sx={{ display: 'contents' }}>
            <Typography component="dt" variant="body2" sx={{ color: '#3f4949' }}>
              {k}
            </Typography>
            <Typography component="dd" variant="body2">
              {v}
            </Typography>
          </Box>
        ))}
      </Box>

      <Typography variant="h6" component="h3" sx={{ mt: 6, mb: 2 }}>
        Summary
      </Typography>
      <Box
        component="ul"
        aria-label="Summary"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 3,
          p: 0,
          m: 0,
          listStyle: 'none',
        }}
      >
        {doc.summary.map(([label, value]) => (
          <Box
            component="li"
            key={label}
            aria-label={`${label}: ${value}`}
            sx={{ border: '1px solid #bec9c8', borderRadius: 1, p: 2, breakInside: 'avoid' }}
          >
            <Typography variant="caption" sx={{ color: '#3f4949' }}>
              {label}
            </Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 600 }}>{value}</Typography>
          </Box>
        ))}
      </Box>

      {doc.tables.map((t) => (
        <Box key={t.title} sx={{ mt: 6 }}>
          <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
            {t.title}
          </Typography>
          {t.rows.length === 0 ? (
            <Typography variant="body2">{t.empty}</Typography>
          ) : (
            <Box
              component="table"
              aria-label={t.title}
              sx={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 12,
                '& th, & td': {
                  borderBottom: '1px solid #dde4e3',
                  textAlign: 'left',
                  p: '6px 8px',
                  verticalAlign: 'top',
                },
                '& th': { bgcolor: '#eff5f4', fontWeight: 600 },
                '& thead': { display: 'table-header-group' },
                '& tr': { breakInside: 'avoid' },
                '& td:nth-of-type(-n+2)': { whiteSpace: 'nowrap' },
              }}
            >
              <thead>
                <tr>
                  {t.columns.map((c) => (
                    <th key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Box>
          )}
        </Box>
      ))}

      <Typography
        variant="caption"
        component="p"
        sx={{ mt: 8, pt: 3, borderTop: '1px solid #bec9c8', color: '#3f4949' }}
      >
        Generated by {generatedBy} on{' '}
        {generatedAt.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}. Test alarms are
        left out.
      </Typography>
    </Paper>
  );
}

/** RPT-03: an A4 preview of the report, to print, save as PDF or download as CSV. */
export function ReportPreviewPage() {
  const [params] = useSearchParams();
  const type = params.get('type');
  const range: ReportRange = { from: params.get('from') ?? '', to: params.get('to') ?? '' };
  const roomId = params.get('room');
  const ok = isReportType(type) && isValidRange(range);
  const user = useCurrentUser();
  const rooms = useRooms();
  const incidents = useIncidentsBetween(range, ok);
  const [generatedAt] = useState(() => new Date());

  if (!ok) return <NotFoundPage />;

  const room = roomId ? rooms.data?.find((r) => r.id === roomId) : undefined;
  const header: [string, string][] = [
    ['Period', `${day(range.from)} to ${day(range.to)}`],
    ['Rooms', roomId ? (room ? room.name : rooms.isPending ? '…' : 'Unknown room') : 'All rooms and areas'],
  ];
  const doc = incidents.data ? buildReport(type, incidents.data, range, roomId) : null;
  const back = `/reports/new`;

  return (
    <>
      {printStyles}
      <PageHeader
        title="Report preview"
        breadcrumb={
          <RouterLink to="/reports" style={{ color: 'inherit' }}>
            Reports & analytics
          </RouterLink>
        }
        actions={
          <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2 }}>
            <Button variant="outlined" component={RouterLink} to={back}>
              Change report
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadOutlined />}
              disabled={!doc}
              onClick={() =>
                doc &&
                downloadCsv(
                  `elderguard-${type.replace(/_/g, '-')}-${range.from}-to-${range.to}.csv`,
                  reportToCsv(doc, [['Facility', FACILITY_NAME], ...header, ['Generated by', user.fullName]]),
                )
              }
            >
              Download CSV
            </Button>
            <Button
              variant="contained"
              startIcon={<PrintOutlined />}
              disabled={!doc}
              onClick={() => window.print()}
            >
              Print or save as PDF
            </Button>
          </Stack>
        }
      />
      {incidents.isPending ? (
        <SkeletonRows rows={6} />
      ) : incidents.isError ? (
        <ErrorState error={incidents.error} onRetry={() => void incidents.refetch()} />
      ) : (
        doc && <ReportBody doc={doc} header={header} generatedBy={user.fullName} generatedAt={generatedAt} />
      )}
    </>
  );
}
