"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { MasterDataCombobox } from "@/components/employees/master-data-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createEmployee,
  updateEmployee,
  createDepartment,
  createJobPosition,
  createJobLevel,
  createEmploymentStatus,
} from "@/app/actions/employees";
import { ImagePlus, Trash2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import type { Department, JobPosition, EmploymentStatus, JobLevel, Employee, Allowance, EmployeeAllowance } from "@/lib/supabase/types";

type Props = {
  departments: Department[];
  jobPositions: JobPosition[];
  employmentStatuses: EmploymentStatus[];
  jobLevels: JobLevel[];
  allowances: Allowance[];
  employee?: Employee;
  onSuccess?: () => void;
  onCancel?: () => void;
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function Required() {
  return <span className="text-destructive">*</span>;
}

export function EmployeeForm({
  departments,
  jobPositions,
  employmentStatuses,
  jobLevels,
  allowances,
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
  const [joinDate, setJoinDate] = useState(employee?.join_date ?? "");
  const [nik, setNik] = useState(employee?.nik ?? "");
  const [address, setAddress] = useState(employee?.address ?? "");
  const [gender, setGender] = useState<string>(employee?.gender ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(employee?.photo_url ?? null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [departmentId, setDepartmentId] = useState<string | null>(employee?.department_id ?? null);
  const [jobPositionId, setJobPositionId] = useState<string | null>(employee?.job_position_id ?? null);
  const [jobLevelId, setJobLevelId] = useState<string | null>(employee?.job_level_id ?? null);
  const [employmentStatusId, setEmploymentStatusId] = useState<string | null>(employee?.employment_status_id ?? null);
  const [bankName, setBankName] = useState(employee?.bank_name ?? "");
  const [bankAccountNo, setBankAccountNo] = useState(employee?.bank_account_no ?? "");
  const [accountHolderName, setAccountHolderName] = useState(employee?.account_holder_name ?? "");
  const [basicSalary, setBasicSalary] = useState(employee?.basic_salary != null ? String(employee.basic_salary) : "");
  const [salaryUnit, setSalaryUnit] = useState<"day" | "month">(employee?.salary_unit ?? "month");
  const [dailyAllowance, setDailyAllowance] = useState(employee?.daily_allowance != null ? String(employee.daily_allowance) : "");
  const [allowanceRows, setAllowanceRows] = useState<EmployeeAllowance[]>(employee?.allowances ?? []);
  const [loginEmail, setLoginEmail] = useState("");

  // Basic salary is per month; part-time crew can choose per day or per month.
  const statusName = employmentStatuses.find((s) => s.id === employmentStatusId)?.name.toLowerCase() ?? "";
  const isPartTime = statusName.includes("part");
  const effectiveSalaryUnit = isPartTime ? salaryUnit : "month";
  // Additional allowances come from the non-default master entries.
  const addableAllowances = allowances.filter((a) => !a.is_default && a.type === "earning");
  const usedIds = new Set(allowanceRows.map((r) => r.allowance_id));
  const availableToAdd = addableAllowances.filter((a) => !usedIds.has(a.id));

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > MAX_IMAGE_BYTES) { toast.error("Image must be under 10MB"); return; }

    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(file);
      const supabase = createClient();
      const path = `${employee?.id ?? crypto.randomUUID()}/${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("crew-photos")
        .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
      if (error) { toast.error(error.message); return; }
      const { data } = supabase.storage.from("crew-photos").getPublicUrl(path);
      setPhotoUrl(data.publicUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload the photo");
    } finally {
      setUploadingPhoto(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!email.trim()) { toast.error("Email is required"); return; }
    if (!phone.trim()) { toast.error("WhatsApp no is required"); return; }
    if (!joinDate) { toast.error("Join date is required"); return; }
    if (!departmentId) { toast.error("Department is required"); return; }
    if (!jobPositionId) { toast.error("Job position is required"); return; }
    if (!jobLevelId) { toast.error("Job level is required"); return; }
    if (!employmentStatusId) { toast.error("Employment status is required"); return; }

    start(async () => {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        birthdate,
        join_date: joinDate,
        nik: nik.trim(),
        address: address.trim(),
        gender: gender || null,
        photo_url: photoUrl,
        department_id: departmentId,
        job_position_id: jobPositionId,
        job_level_id: jobLevelId,
        employment_status_id: employmentStatusId,
        bank_name: bankName.trim(),
        bank_account_no: bankAccountNo.trim(),
        account_holder_name: accountHolderName.trim(),
        basic_salary: basicSalary === "" ? null : Number(basicSalary),
        salary_unit: effectiveSalaryUnit,
        daily_allowance: dailyAllowance === "" ? null : Number(dailyAllowance),
        allowances: allowanceRows
          .filter((r) => r.allowance_id)
          .map((r) => ({ allowance_id: r.allowance_id, amount: Number(r.amount) || 0 })),
        login_email: isEdit ? "" : loginEmail.trim(),
      };

      const res = isEdit
        ? await updateEmployee(employee!.id, payload)
        : await createEmployee(payload);

      if (!res.ok) { toast.error(res.error); return; }

      toast.success(isEdit ? "Saved" : "Crew created");
      router.refresh();
      if (onSuccess) {
        onSuccess();
      } else if (isEdit) {
        router.push(`/hr/crew/${employee!.id}`);
      } else {
        router.push(res.id ? `/hr/crew/${res.id}` : "/hr/crew");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col flex-1 gap-6">
      <div className="flex flex-col gap-8 md:flex-row md:gap-10">
        {/* Left: the 6-column form */}
        <div className="order-2 flex min-w-0 flex-1 flex-col gap-8 md:order-1">
          {/* Employee info */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold">Employee info</h2>
            <div className="grid grid-cols-6 gap-4">
              <div className="col-span-6 space-y-2">
                <Label htmlFor="name">Name <Required /></Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="col-span-6 space-y-2 sm:col-span-3">
                <Label htmlFor="email">Email <Required /></Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div className="col-span-6 space-y-2 sm:col-span-3">
                <Label htmlFor="phone">WhatsApp no <Required /></Label>
                <Input
                  id="phone"
                  type="text"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="col-span-6 space-y-2 sm:col-span-3">
                <Label htmlFor="birthdate">Birthdate</Label>
                <Input id="birthdate" type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
              </div>

              <div className="col-span-6 space-y-2 sm:col-span-3">
                <Label htmlFor="nik">NIK</Label>
                <Input id="nik" type="text" value={nik} onChange={(e) => setNik(e.target.value)} />
              </div>

              <div className="col-span-6 space-y-2">
                <Label>Gender</Label>
                <div className="flex h-8 items-center gap-6">
                  {(["male", "female"] as const).map((g) => (
                    <label key={g} className="flex cursor-pointer select-none items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="gender"
                        value={g}
                        checked={gender === g}
                        onChange={() => setGender(g)}
                        className="accent-primary"
                      />
                      {g === "male" ? "Male" : "Female"}
                    </label>
                  ))}
                </div>
              </div>

              <div className="col-span-6 space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} rows={3} />
              </div>
            </div>
          </section>

          {/* Employment info */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold">Employment info</h2>
            <div className="grid grid-cols-6 gap-4">
              <div className="col-span-6 space-y-2 sm:col-span-3">
                <Label htmlFor="join-date">Join date <Required /></Label>
                <Input id="join-date" type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
              </div>

              <div className="col-span-6 space-y-2 sm:col-span-3">
                <Label>Job position <Required /></Label>
                <MasterDataCombobox
                  options={jobPositions}
                  value={jobPositionId}
                  onChange={(id) => {
                    setJobPositionId(id);
                    // Department follows the position's department.
                    const pos = jobPositions.find((p) => p.id === id);
                    if (pos?.department_id) setDepartmentId(pos.department_id);
                  }}
                  placeholder="Select position"
                  entityLabel="Job position"
                  onCreate={(dataName) => createJobPosition({ name: dataName, department_id: departmentId })}
                />
              </div>

              <div className="col-span-6 space-y-2 sm:col-span-3">
                <Label>Department <Required /></Label>
                <MasterDataCombobox
                  options={departments}
                  value={departmentId}
                  onChange={setDepartmentId}
                  placeholder="Select department"
                  entityLabel="Department"
                  onCreate={(dataName) => createDepartment({ name: dataName })}
                />
              </div>

              <div className="col-span-6 space-y-2 sm:col-span-3">
                <Label>Job level <Required /></Label>
                <MasterDataCombobox
                  options={jobLevels}
                  value={jobLevelId}
                  onChange={setJobLevelId}
                  placeholder="Select level"
                  entityLabel="Job level"
                  onCreate={(dataName) => createJobLevel({ name: dataName })}
                />
              </div>

              <div className="col-span-6 space-y-2 sm:col-span-3">
                <Label>Employment status <Required /></Label>
                <MasterDataCombobox
                  options={employmentStatuses}
                  value={employmentStatusId}
                  onChange={setEmploymentStatusId}
                  placeholder="Select status"
                  entityLabel="Employment status"
                  onCreate={(dataName) => createEmploymentStatus({ name: dataName })}
                />
              </div>
            </div>
          </section>

          {/* Crew login (create only — for existing crew, set it from the detail page) */}
          {!isEdit && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold">Crew login</h2>
              <div className="grid grid-cols-6 gap-4">
                <div className="col-span-6 space-y-2 sm:col-span-3">
                  <Label htmlFor="login-email">Login email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="crew@email.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Opsional — email untuk login crew di me.machimoto.cafe. Password awal{" "}
                    <span className="font-medium">crew-2026</span>, wajib diganti saat login pertama. Bisa diisi belakangan dari halaman detail crew.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Bank info */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold">Bank info</h2>
            <div className="grid grid-cols-6 gap-4">
              <div className="col-span-6 space-y-2 sm:col-span-3">
                <Label htmlFor="bank-name">Bank name</Label>
                <Input id="bank-name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </div>
              <div className="col-span-6 space-y-2 sm:col-span-3">
                <Label htmlFor="bank-account-no">Bank account number</Label>
                <Input id="bank-account-no" inputMode="numeric" value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)} />
              </div>
              <div className="col-span-6 space-y-2 sm:col-span-3">
                <Label htmlFor="account-holder">Account holder name</Label>
                <Input id="account-holder" value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} />
              </div>
            </div>
          </section>

          {/* Compensation */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold">Compensation</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="basic-salary">Basic salary</Label>
                {isPartTime ? (
                  <div className="flex items-center gap-2">
                    <InputGroup className="h-10 flex-1">
                      <InputGroupAddon align="inline-start"><InputGroupText>Rp</InputGroupText></InputGroupAddon>
                      <InputGroupInput id="basic-salary" type="number" min="0" value={basicSalary} onChange={(e) => setBasicSalary(e.target.value)} />
                    </InputGroup>
                    <Select value={salaryUnit} onValueChange={(v) => setSalaryUnit(v as "day" | "month")}>
                      <SelectTrigger className="w-36 shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">per day</SelectItem>
                        <SelectItem value="month">per month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <InputGroup className="h-10">
                    <InputGroupAddon align="inline-start"><InputGroupText>Rp</InputGroupText></InputGroupAddon>
                    <InputGroupInput id="basic-salary" type="number" min="0" value={basicSalary} onChange={(e) => setBasicSalary(e.target.value)} />
                    <InputGroupAddon align="inline-end"><InputGroupText>per month</InputGroupText></InputGroupAddon>
                  </InputGroup>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="daily-allowance">Daily allowance</Label>
                <InputGroup className="h-10">
                  <InputGroupAddon align="inline-start"><InputGroupText>Rp</InputGroupText></InputGroupAddon>
                  <InputGroupInput id="daily-allowance" type="number" min="0" value={dailyAllowance} onChange={(e) => setDailyAllowance(e.target.value)} />
                  <InputGroupAddon align="inline-end"><InputGroupText>/day</InputGroupText></InputGroupAddon>
                </InputGroup>
              </div>

              {/* Additional allowances */}
              <div className="space-y-2">
                <Label>Allowances</Label>
                {allowanceRows.length === 0 && (
                  <p className="text-xs text-muted-foreground">No additional allowances.</p>
                )}
                {allowanceRows.map((row, i) => {
                  const opts = addableAllowances.filter(
                    (a) => a.id === row.allowance_id || !usedIds.has(a.id),
                  );
                  return (
                    <div key={i} className="space-y-2 rounded-lg border p-3">
                      <Select
                        value={row.allowance_id}
                        onValueChange={(v) =>
                          setAllowanceRows((rows) => rows.map((r, j) => (j === i ? { ...r, allowance_id: v } : r)))
                        }
                      >
                        <SelectTrigger className="w-full"><SelectValue placeholder="Select allowance" /></SelectTrigger>
                        <SelectContent>
                          {opts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <InputGroup className="h-10 flex-1">
                          <InputGroupAddon align="inline-start"><InputGroupText>Rp</InputGroupText></InputGroupAddon>
                          <InputGroupInput
                            type="number"
                            min="0"
                            value={String(row.amount ?? "")}
                            onChange={(e) =>
                              setAllowanceRows((rows) => rows.map((r, j) => (j === i ? { ...r, amount: Number(e.target.value) || 0 } : r)))
                            }
                          />
                        </InputGroup>
                        <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => setAllowanceRows((rows) => rows.filter((_, j) => j !== i))}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={availableToAdd.length === 0}
                  onClick={() => setAllowanceRows((rows) => [...rows, { allowance_id: availableToAdd[0]?.id ?? "", amount: 0 }])}
                >
                  <Plus className="size-4" /> Add allowance
                </Button>
                {addableAllowances.length === 0 && (
                  <p className="text-xs text-muted-foreground">Add allowance types in Settings → Allowance.</p>
                )}
              </div>
            </div>
          </section>

          {/* Actions — directly below the form, full width (6 columns) */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onCancel ? onCancel() : router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : isEdit ? "Save changes" : "Save"}
            </Button>
          </div>
        </div>

        {/* Photo — outside the 6-column grid, its own column */}
        <div className="order-1 space-y-2 md:order-2 md:w-48 md:shrink-0">
          <Label>Photo</Label>
          <div className="flex flex-col items-start gap-3">
            <div className="size-32 shrink-0 overflow-hidden rounded-lg border bg-muted flex items-center justify-center">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt={name || "Crew"} className="size-full object-cover" />
              ) : (
                <ImagePlus className="size-7 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crew-photo" className="cursor-pointer">
                <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}>
                  {uploadingPhoto ? "Uploading..." : photoUrl ? "Change photo" : "Upload photo"}
                </span>
                <input
                  id="crew-photo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={uploadingPhoto}
                  onChange={handlePhotoChange}
                />
              </Label>
              {photoUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="text-left text-xs text-muted-foreground hover:text-foreground"
                >
                  Remove photo
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Auto-compressed on upload.</p>
          </div>
        </div>
      </div>
    </form>
  );
}
