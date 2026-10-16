import { useState } from 'react';

import { ConfirmDialog, Dialog } from '../ui/Dialog.jsx';
import { CardSkeleton, EmptyState, InlineError, Notice } from '../ui/Feedback.jsx';
import { Field, FormMessage, Input, PasswordInput, Select, Textarea } from '../ui/Field.jsx';
import { Kpi, PageHeader } from '../ui/Page.jsx';
import { IconButton, Pill, PillLink } from '../ui/Pill.jsx';
import Segmented from '../ui/Segmented.jsx';
import {
  PaymentStatusChip,
  RecommendationStatusChip,
  SubscriptionStatusChip,
  Tag,
} from '../ui/Status.jsx';
import { Card, CardHeader } from '../ui/Surface.jsx';
import { PATTERNS } from '../ui/patterns.js';
import { PatternSwatch } from '../ui/SvgDefs.jsx';
import { useToast } from '../ui/toastContext.js';

/**
 * Development-only component kit (route `/kit`, excluded from production builds). Shows
 * every primitive on one page to check cohesion and contrast before real screens.
 * All values here are labelled specimens, not user data.
 */
export default function KitPage() {
  const { notify } = useToast();
  const [segment, setSegment] = useState('week');
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        description="Specimens of every Monochrome Pressure primitive."
        index="00 / Kit"
        title="Component kit"
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-6">
          <CardHeader title="Surfaces" />
          <div className="grid grid-cols-2 gap-4">
            <div className="neu-raised rounded-2xl p-4 text-sm font-bold">Raised · available</div>
            <div className="neu-pressed rounded-2xl p-4 text-sm font-bold">Pressed · committed</div>
            <div className="glass rounded-2xl p-4 text-sm font-bold">Glass · floating</div>
            <div className="obsidian rounded-2xl p-4 text-sm font-bold">Obsidian · attention</div>
          </div>
        </Card>
        <Card className="lg:col-span-6" look="obsidian">
          <CardHeader description="Specimen values only." title="Obsidian card" />
          <Kpi currency="INR" label="Specimen KPI" value="1234.5" />
        </Card>

        <Card className="lg:col-span-12">
          <CardHeader title="Pills" />
          <div className="flex flex-wrap gap-3">
            <Pill variant="ink">Primary ink</Pill>
            <Pill>Raised</Pill>
            <Pill variant="outline">Outline</Pill>
            <Pill variant="ghost">Ghost</Pill>
            <Pill disabled>Disabled</Pill>
            <Pill icon="plus" size="sm" variant="ink">
              Small
            </Pill>
            <PillLink icon="arrowRight" to="/dashboard">
              Link pill
            </PillLink>
            <IconButton icon="search" label="Icon button" />
            <Pill onClick={() => notify('Saved the specimen.')}>Success toast</Pill>
            <Pill onClick={() => notify('The specimen failed.', { tone: 'error' })}>
              Error toast
            </Pill>
            <Pill onClick={() => setDialog(true)}>Open sheet</Pill>
            <Pill onClick={() => setConfirm(true)}>Confirm dialog</Pill>
          </div>
          <Segmented
            className="mt-6"
            label="Segmented control"
            onChange={setSegment}
            options={[
              { label: 'Day', value: 'day' },
              { label: 'Week', value: 'week' },
              { label: 'Month', value: 'month' },
            ]}
            value={segment}
          />
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader title="Fields" />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field hint="Hint text" label="Text input">
              {(id, describedBy) => (
                <Input aria-describedby={describedBy} id={id} placeholder="Placeholder" />
              )}
            </Field>
            <Field error="This field needs attention." label="Invalid input">
              {(id, describedBy, invalid) => (
                <Input aria-describedby={describedBy} id={id} invalid={invalid} />
              )}
            </Field>
            <Field label="Select">
              {(id) => (
                <Select id={id}>
                  <option>Option one</option>
                  <option>Option two</option>
                </Select>
              )}
            </Field>
            <Field label="Date">{(id) => <Input id={id} type="date" />}</Field>
            <Field label="Kit password">
              {(id) => <PasswordInput id={id} label="Kit password" />}
            </Field>
            <Field label="Notes">{(id) => <Textarea id={id} />}</Field>
          </div>
          <div className="mt-5 space-y-3">
            <FormMessage>Form-level error message.</FormMessage>
            <Notice>Polite success notice.</Notice>
            <InlineError message="Inline section error." onRetry={() => {}} />
          </div>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader title="Chips & patterns" />
          <div className="flex flex-wrap gap-2">
            {['active', 'trial', 'paused', 'cancelled'].map((status) => (
              <SubscriptionStatusChip key={status} status={status} />
            ))}
            <SubscriptionStatusChip archivedAt="x" status="active" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {['completed', 'pending', 'failed', 'cancelled'].map((status) => (
              <PaymentStatusChip key={status} status={status} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {['active', 'resolved', 'dismissed', 'inactive'].map((status) => (
              <RecommendationStatusChip key={status} status={status} />
            ))}
            <Tag>Tag</Tag>
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-2 text-sm">
            {PATTERNS.map((pattern, index) => (
              <li className="flex items-center gap-2" key={pattern.id}>
                <PatternSwatch className="size-6" index={index} />
                {pattern.label}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-6">
          <CardHeader title="Skeleton" />
          <CardSkeleton label="specimen" />
        </Card>
        <Card className="lg:col-span-6">
          <EmptyState action={<Pill variant="ink">Action</Pill>} title="Empty state">
            Designed empty states use the pressed slot.
          </EmptyState>
        </Card>
      </div>

      <Dialog
        description="A glass sheet docks right on desktop and becomes a bottom sheet on phones."
        onOpenChange={setDialog}
        open={dialog}
        title="Sheet"
        variant="sheet"
      >
        <p className="text-sm">Sheet body.</p>
      </Dialog>
      <ConfirmDialog
        confirmLabel="Confirm"
        description="Confirmation dialogs state the consequence in plain words."
        onConfirm={() => setConfirm(false)}
        onOpenChange={setConfirm}
        open={confirm}
        title="Confirm the specimen?"
      />
    </div>
  );
}
