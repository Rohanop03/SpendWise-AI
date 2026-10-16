import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getCategories, getServices } from '../api/catalog.js';
import { getApiErrorMessage } from '../api/http.js';
import { getSubscription, updateSubscription } from '../api/subscriptions.js';
import SubscriptionForm from '../components/subscriptions/SubscriptionForm.jsx';
import { pageIndex } from '../layout/nav.js';
import { CardSkeleton, EmptyState, InlineError } from '../ui/Feedback.jsx';
import { PageHeader } from '../ui/Page.jsx';
import { BackLink, PillLink } from '../ui/Pill.jsx';
import { Card } from '../ui/Surface.jsx';
import { useToast } from '../ui/toastContext.js';

export default function EditSubscriptionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [state, setState] = useState({ error: '', loading: true });
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getSubscription(id), getCategories(), getServices()])
      .then(([sub, cats, svcs]) =>
        setState({
          archived: Boolean(sub.archivedAt),
          categories: cats,
          defaults: {
            billingCycle: sub.billingCycle,
            categoryId: String(sub.categoryId),
            currencyCode: sub.currencyCode,
            customServiceName: sub.customServiceName || '',
            nextRenewalDate: sub.nextRenewalDate || '',
            notes: sub.notes || '',
            planName: sub.planName || '',
            price: String(sub.price),
            serviceId: sub.serviceId ? String(sub.serviceId) : '',
            serviceMode: sub.serviceId ? 'catalog' : 'custom',
            startDate: sub.startDate,
            status: sub.status,
            trialEndDate: sub.trialEndDate || '',
          },
          error: '',
          loading: false,
          name: sub.serviceName,
          services: svcs,
        }),
      )
      .catch((err) => setState({ error: getApiErrorMessage(err), loading: false }));
  }, [id]);

  async function handleSubmit(values) {
    setError('');
    // Same full PATCH payload as before, with explicit nulls for cleared fields.
    const payload = {
      billingCycle: values.billingCycle,
      categoryId: values.categoryId,
      currencyCode: values.currencyCode.toUpperCase(),
      nextRenewalDate: values.nextRenewalDate || null,
      notes: values.notes.trim() || null,
      planName: values.planName.trim() || null,
      price: Number(values.price),
      startDate: values.startDate,
      status: values.status,
      trialEndDate: values.status === 'trial' ? values.trialEndDate || null : null,
    };
    if (values.serviceMode === 'catalog') {
      payload.serviceId = values.serviceId;
      payload.customServiceName = null;
    } else {
      payload.customServiceName = values.customServiceName.trim();
      payload.serviceId = null;
    }

    try {
      await updateSubscription(id, payload);
      notify('Changes saved.');
      navigate(`/subscriptions/${id}`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  if (state.archived) {
    return (
      <Card className="mx-auto max-w-xl">
        <EmptyState
          action={
            <PillLink to={`/subscriptions/${id}`} variant="ink">
              View Details & Restore
            </PillLink>
          }
          title="Subscription is Archived"
          titleAs="h1"
        >
          This subscription is currently archived. Please restore it from the details page before
          editing.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <BackLink to={`/subscriptions/${id}`}>Cancel and return to Details</BackLink>
      <PageHeader
        description="Update pricing, change provider, or revise renewal schedule."
        index={pageIndex('/subscriptions')}
        title="Edit Subscription"
      />
      <Card className="sm:p-8" look="glass">
        {state.loading ? (
          <CardSkeleton label="subscription details" lines={5} tall />
        ) : state.error ? (
          <InlineError message={state.error} />
        ) : (
          <SubscriptionForm
            apiError={error}
            cancelTo={`/subscriptions/${id}`}
            categories={state.categories}
            defaultValues={state.defaults}
            onSubmit={handleSubmit}
            services={state.services}
            submitLabel="Save Changes"
            submittingLabel="Saving…"
          />
        )}
      </Card>
    </div>
  );
}
