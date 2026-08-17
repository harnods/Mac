"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateAttendanceSettings } from "@/app/actions/attendance";
import type { AttendanceSettings } from "@/lib/supabase/types";

function DetailRow({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm sm:col-span-2">
        {value}
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </dd>
    </div>
  );
}

export function AttendanceSettingsView({
  settings,
  isAdmin,
}: {
  settings: AttendanceSettings | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [lateGrace, setLateGrace] = useState(String(settings?.late_grace_minutes ?? 15));
  const [lateDir, setLateDir] = useState<"before" | "after">(settings?.late_tolerance_direction ?? "after");
  const [earlyGrace, setEarlyGrace] = useState(String(settings?.early_leave_grace_minutes ?? 15));
  const [workingDays, setWorkingDays] = useState(String(settings?.working_days_per_week ?? 6));
  const [allowedIps, setAllowedIps] = useState(settings?.allowed_ips ?? "");
  const [storeLat, setStoreLat] = useState(settings?.store_lat != null ? String(settings.store_lat) : "");
  const [storeLng, setStoreLng] = useState(settings?.store_lng != null ? String(settings.store_lng) : "");
  const [radius, setRadius] = useState(settings?.geofence_radius_m != null ? String(settings.geofence_radius_m) : "");
  const [requireLocation, setRequireLocation] = useState(settings?.require_location ?? false);
  const [earliest, setEarliest] = useState(settings?.clock_in_earliest?.slice(0, 5) ?? "");
  const [latest, setLatest] = useState(settings?.clock_in_latest?.slice(0, 5) ?? "");

  const workDays = settings?.working_days_per_week ?? 6;
  const late = settings?.late_grace_minutes ?? 15;
  const early = settings?.early_leave_grace_minutes ?? 15;
  const dir = settings?.late_tolerance_direction ?? "after";

  function openEdit() {
    if (!settings) return;
    setLateGrace(String(settings.late_grace_minutes));
    setLateDir(settings.late_tolerance_direction);
    setEarlyGrace(String(settings.early_leave_grace_minutes));
    setWorkingDays(String(settings.working_days_per_week));
    setAllowedIps(settings.allowed_ips ?? "");
    setStoreLat(settings.store_lat != null ? String(settings.store_lat) : "");
    setStoreLng(settings.store_lng != null ? String(settings.store_lng) : "");
    setRadius(settings.geofence_radius_m != null ? String(settings.geofence_radius_m) : "");
    setRequireLocation(settings.require_location);
    setEarliest(settings.clock_in_earliest?.slice(0, 5) ?? "");
    setLatest(settings.clock_in_latest?.slice(0, 5) ?? "");
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    start(async () => {
      const res = await updateAttendanceSettings(settings.id, {
        working_days_per_week: Number(workingDays),
        allowed_ips: allowedIps,
        late_grace_minutes: Number(lateGrace),
        late_tolerance_direction: lateDir,
        early_leave_grace_minutes: Number(earlyGrace),
        store_lat: storeLat.trim() ? Number(storeLat) : null,
        store_lng: storeLng.trim() ? Number(storeLng) : null,
        geofence_radius_m: radius.trim() ? Number(radius) : null,
        require_location: requireLocation,
        clock_in_earliest: earliest,
        clock_in_latest: latest,
      });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Attendance settings saved");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
        {isAdmin && settings && (
          <Button variant="secondary" onClick={openEdit}>Edit</Button>
        )}
      </div>

      {settings ? (
        <dl className="max-w-2xl">
          <DetailRow
            label="Working days per week"
            value={`${workDays} of 7 days`}
            hint={`${workDays} working day${workDays === 1 ? "" : "s"} and ${7 - workDays} day off per week.`}
          />
          <DetailRow
            label="Late tolerance"
            value={`${late} minute${late === 1 ? "" : "s"} ${dir} shift start`}
            hint={
              dir === "after"
                ? `Clocking in more than ${late} minutes after the shift start time counts as Late.`
                : `Crew must clock in at least ${late} minutes before the shift start time; later than that counts as Late.`
            }
          />
          <DetailRow
            label="Early clock-out tolerance"
            value={`${early} minute${early === 1 ? "" : "s"} before shift end`}
            hint={`Clocking out more than ${early} minutes before the shift end time counts as Early leave.`}
          />
          <DetailRow
            label="Allowed network (store wifi)"
            value={settings.allowed_ips ? <span className="tabular-nums">{settings.allowed_ips}</span> : "Any network"}
            hint={
              settings.allowed_ips
                ? "Crew can only clock in/out from these public IPs — the store wifi. Home/mobile data is blocked."
                : "No restriction — crew can clock in/out from any network. Set the store's public IP(s) to lock it down."
            }
          />
          <DetailRow
            label="Store location (geofence)"
            value={settings.store_lat != null && settings.store_lng != null && settings.geofence_radius_m != null
              ? <span className="tabular-nums">{settings.store_lat}, {settings.store_lng} · {settings.geofence_radius_m} m{settings.require_location ? " · required" : ""}</span>
              : "Not set"}
            hint={settings.store_lat != null
              ? "Clock-in must be within this radius of the store (by phone GPS)."
              : "No geofence — set the store's coordinates + radius to require clock-in at the store."}
          />
          <DetailRow
            label="Clock-in time window"
            value={settings.clock_in_earliest || settings.clock_in_latest
              ? `${settings.clock_in_earliest?.slice(0, 5) ?? "—"} to ${settings.clock_in_latest?.slice(0, 5) ?? "—"}`
              : "Any time"}
            hint="Clock-in outside this window is blocked."
          />
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">Attendance settings are not available.</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit attendance settings</DialogTitle>
            <DialogDescription>
              Set how many minutes of tolerance are allowed before a clock-in counts as Late or a clock-out counts as Early leave.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="working-days">Working days per week</Label>
              <div className="flex items-center gap-2">
                <Input id="working-days" type="number" min="1" max="7" value={workingDays} onChange={(e) => setWorkingDays(e.target.value)} className="w-24" />
                <span className="text-sm text-muted-foreground">of 7 days</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {Number(workingDays) || 0} working day{Number(workingDays) === 1 ? "" : "s"} and {7 - (Number(workingDays) || 0)} day off per week.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="allowed-ips">Allowed network (store wifi)</Label>
              <Input id="allowed-ips" value={allowedIps} onChange={(e) => setAllowedIps(e.target.value)} placeholder="e.g. 103.20.5.10, 103.20.5.0/24" />
              <p className="text-xs text-muted-foreground">
                Store&rsquo;s public IP address(es) or CIDR range(s), comma-separated. Crew can only clock in/out from these. Leave empty to allow any network.
              </p>
              <p className="text-xs text-amber-600">
                Tip: use the store&rsquo;s exact public IP, not a broad /24 — an ISP block can let crew on the same provider clock in from home.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Store location (geofence)</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input value={storeLat} onChange={(e) => setStoreLat(e.target.value)} placeholder="Latitude" />
                <Input value={storeLng} onChange={(e) => setStoreLng(e.target.value)} placeholder="Longitude" />
                <Input type="number" min="10" max="5000" value={radius} onChange={(e) => setRadius(e.target.value)} placeholder="Radius m" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={requireLocation} onChange={(e) => setRequireLocation(e.target.checked)} className="size-4" />
                Require GPS location to clock in/out
              </label>
              <p className="text-xs text-muted-foreground">
                Set the store&rsquo;s coordinates + radius (metres) to only allow clock-in within that circle. Tip: open Google Maps at the store, right-click → copy the lat, long.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Clock-in time window</Label>
              <div className="flex items-center gap-2">
                <Input type="time" value={earliest} onChange={(e) => setEarliest(e.target.value)} className="w-32" />
                <span className="text-sm text-muted-foreground">to</span>
                <Input type="time" value={latest} onChange={(e) => setLatest(e.target.value)} className="w-32" />
              </div>
              <p className="text-xs text-muted-foreground">Clock-in is blocked outside this window. Leave empty for no limit.</p>
            </div>
            <div className="space-y-2">
              <Label>Late tolerance</Label>
              <div className="flex items-center gap-2">
                <Input aria-label="Minutes" type="number" min="0" max="240" value={lateGrace} onChange={(e) => setLateGrace(e.target.value)} className="w-24" />
                <span className="text-sm text-muted-foreground">min</span>
                <Select value={lateDir} onValueChange={(v) => setLateDir(v as "before" | "after")}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="after">after shift start</SelectItem>
                    <SelectItem value="before">before shift start</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {lateDir === "after"
                  ? "Clock-in later than this past the shift start is marked Late."
                  : "Crew must clock in at least this early; clocking in later is marked Late."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="early-grace">Early clock-out tolerance (minutes before end)</Label>
              <Input id="early-grace" type="number" min="0" max="240" value={earlyGrace} onChange={(e) => setEarlyGrace(e.target.value)} className="w-40" />
              <p className="text-xs text-muted-foreground">Clock-out earlier than this before the shift end is marked Early leave.</p>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
