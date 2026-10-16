import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getCategories, getServices } from '../api/catalog.js';
import { getApiErrorMessage } from '../api/http.js';
import { getSubscription, updateSubscription } from '../api/subscriptions.js';
import SubscriptionForm from '../components/subscriptions/SubscriptionForm.jsx';
import { toSubscriptionPayload } from '../forms/schemas.js';
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
          defaults: (() => {
            // A name that matches a catalog service opens in catalog mode.
            const catalogMatch = svcs.find(
              (svc) => svc.name.toLowerCase() === sub.serviceName.toLowerCase(),
            );
            return {
              billingCycle: sub.billingCycle,
              categoryId: String(sub.categoryId),
              cost: String(sub.cost),
              currencyCode: sub.currencyCode,
              customServiceName: catalogMatch ? '' : sub.serviceName,
              lastUsedDate: sub.lastUsedDate || '',
              notes: sub.notes || '',
              planName: sub.planName || '',
              renewalDate: sub.renewalDate,
              serviceId: catalogMatch ? catalogMatch.id : '',
              serviceMode: catalogMatch ? 'catalog' : 'custom',
              startDate: sub.startDate,
              status: sub.status,
            };
          })(),
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
    const payload = toSubscriptionPayload(values, state.services, { includeStatus: true });

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
            showStatus
            submitLabel="Save Changes"
            submittingLabel="Saving…"
          />
        )}
      </Card>
    </div>
  );
}
