import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router';
import { isValidRange, lastDays, REPORT_TYPES, type ReportRange, type ReportType } from '@elderguard/shared';
import { useRooms } from '../../api/queries';
import { PageHeader } from '../../components/PageHeader';

/** RPT-02: choose what goes in a report, then preview it to print, save as PDF or download as CSV. */
export function GenerateReportPage() {
  const navigate = useNavigate();
  const rooms = useRooms();
  const [type, setType] = useState<ReportType>('incident_summary');
  const [range, setRange] = useState<ReportRange>(() => lastDays(30));
  const [roomId, setRoomId] = useState('');
  const valid = isValidRange(range);

  const preview = () => {
    const params = new URLSearchParams({ type, from: range.from, to: range.to });
    if (roomId) params.set('room', roomId);
    void navigate(`/reports/preview?${params}`);
  };

  return (
    <>
      <PageHeader
        title="Generate report"
        breadcrumb={
          <RouterLink to="/reports" style={{ color: 'inherit' }}>
            Reports & analytics
          </RouterLink>
        }
      />
      <Card sx={{ maxWidth: 720 }}>
        <CardContent sx={{ p: 6 }}>
          <Stack
            component="form"
            spacing={6}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) preview();
            }}
          >
            <FormControl>
              <FormLabel id="report-type">Report type</FormLabel>
              <RadioGroup
                aria-labelledby="report-type"
                value={type}
                onChange={(e) => setType(e.target.value as ReportType)}
              >
                {REPORT_TYPES.map((t) => (
                  <FormControlLabel
                    key={t.id}
                    value={t.id}
                    control={<Radio />}
                    sx={{ mt: 1 }}
                    label={
                      <>
                        <Typography variant="body1">{t.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t.description}
                        </Typography>
                      </>
                    }
                  />
                ))}
              </RadioGroup>
            </FormControl>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
              <TextField
                label="From"
                type="date"
                value={range.from}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="To"
                type="date"
                value={range.to}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>
            {!valid && <Alert severity="warning">Choose a start date on or before the end date.</Alert>}

            <TextField
              select
              label="Room or area"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              helperText={rooms.isError ? 'Rooms could not be loaded, so the report covers all rooms.' : ' '}
              sx={{ maxWidth: 360 }}
            >
              <MenuItem value="">All rooms and areas</MenuItem>
              {(rooms.data ?? []).map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.wing ? `${r.name} · ${r.wing}` : r.name}
                </MenuItem>
              ))}
            </TextField>

            <Typography variant="body2" color="text.secondary">
              The preview can be printed, saved as a PDF from the print window, or downloaded as a CSV file
              that opens in Excel. Camera uptime reports are not available yet because the server does not
              keep a history of camera status.
            </Typography>

            <Stack direction="row" spacing={3}>
              <Button type="submit" variant="contained" disabled={!valid}>
                Preview report
              </Button>
              <Button variant="outlined" component={RouterLink} to="/reports">
                Cancel
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </>
  );
}
