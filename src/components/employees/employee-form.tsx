"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createEmployee, updateEmployee } from "@/app/actions/employees";
import type { Department, JobPosition, EmploymentStatus, JobLevel, Employee } from "@/lib/supabase/types";

type Props = {
  departments: Department[];
  jobPositions: JobPosition[];
  employmentStatuses: EmploymentStatus[];
  jobLevels: JobLevel[];
  employee?: Employee;
  onSuccess?: () => void;
  onCancel?: () => void;
};

const EMPTY = "__none__";

export function EmployeeForm({
  departments,
  jobPositions,
  employmentStatuses,
  jobLevels,
  employee,
  onSuccess,
  onCancel,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isEdit = !!employee;

  const [name, setName] = useState(employee?.name ?? "");
  const [email, setEmail] = useState(employee?.email ?? "");
  const [phone, setPhone] = useState(employee?.phone ?? "");
  const [birthdate, setBirthdate] = useState(employee?.birthdate ?? "");
  const [nik, setNik] = useState(employee?.nik ?? "");
  const [address, setAddress] = useState(employee?.address ?? "");
  const [gender, setGender] = useState<string>(employee?.gender ?? EMPTY);
  const [maritalStatus, setMaritalStatus] = useState<string>(employee?.marital_status ?? EMPTY);
  const [departmentId, setDepartmentId] = useState<string>(employee?.department_id ?? EMPTY);
  const [jobPositionId, setJobPositionId] = useState<string>(employee?.job_position_id ?? EMPTY);
  const [jobLevelId, setJobLevelId] = useState<string>(employee?.job_level_id ?? EMPTY);
  const [employmentStatusId, setEmploymentStatusId] = useState<string>(employee?.employment_status_id ?? EMPTY);

  function toPayloadValue(val: string): string | null {
    return val === EMPTY ? "" : val;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const payload = {
        name,
        email: toPayloadValue(email) ?? "",
        phone: toPayloadValue(phone) ?? "",
        birthdate: toPayloadValue(birthdate) ?? "",
        nik: toPayloadValue(nik) ?? "",
        address: toPayloadValue(address) ?? "",
        gender: gender === EMPTY ? null : gender,
        marital_status: maritalStatus === EMPTY ? null : maritalStatus,
        department_id: departmentId === EMPTY ? null : departmentId,
        job_position_id: jobPositionId === EMPTY ? null : jobPositionId,
        job_level_id: jobLevelId === EMPTY ? null : jobLevelId,
        employment_status_id: employmentStatusId === EMPTY ? null : employmentStatusId,
      };

      const res = isEdit
        ? await updateEmployee(employee!.id, payload)
        : await createEmployee(payload);

      if (!res.ok) { toast.error(res.error); return; }
      toast.success(isEdit ? "Saved" : "Employee created");
      router.refresh();
      if (onSuccess) {
        onSuccess();
      } else if (isEdit) {
        router.push(`/employees/${employee!.id}`);
      } else {
        router.push(res.id ? `/employees/${res.id}` : "/employees");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Personal info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 space-y-2">
          <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
          <Input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="birthdate">Birthdate</Label>
          <Input
            id="birthdate"
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nik">NIK (ID number)</Label>
          <Input
            id="nik"
            type="text"
            value={nik}
            onChange={(e) => setNik(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger id="gender">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY}>—</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="marital-status">Marital status</Label>
          <Select value={maritalStatus} onValueChange={setMaritalStatus}>
            <SelectTrigger id="marital-status">
              <SelectValue placeholder="Select marital status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY}>—</SelectItem>
              <SelectItem value="single">Single</SelectItem>
              <SelectItem value="married">Married</SelectItem>
              <SelectItem value="divorced">Divorced</SelectItem>
              <SelectItem value="widowed">Widowed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-2 space-y-2">
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
          />
        </div>
      </div>

      {/* Employment info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="department">Department</Label>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger id="department">
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY}>—</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="job-position">Job position</Label>
          <Select value={jobPositionId} onValueChange={setJobPositionId}>
            <SelectTrigger id="job-position">
              <SelectValue placeholder="Select position" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY}>—</SelectItem>
              {jobPositions.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="job-level">Job level</Label>
          <Select value={jobLevelId} onValueChange={setJobLevelId}>
            <SelectTrigger id="job-level">
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY}>—</SelectItem>
              {jobLevels.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="employment-status">Employment status</Label>
          <Select value={employmentStatusId} onValueChange={setEmploymentStatusId}>
            <SelectTrigger id="employment-status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY}>—</SelectItem>
              {employmentStatuses.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={() => onCancel ? onCancel() : router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : isEdit ? "Save changes" : "Create employee"}
        </Button>
      </div>
    </form>
  );
}
