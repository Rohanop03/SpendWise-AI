import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getPreferences } from '../api/account.js';
import { getCategories, getServices } from '../api/catalog.js';
import { getApiErrorMessage } from '../api/http.js';
import { createSubscription } from '../api/subscriptions.js';
import SubscriptionForm from '../components/subscriptions/SubscriptionForm.jsx';
import { localToday } from '../forms/renewal.js';
import { toSubscriptionPayload } from '../forms/schemas.js';
import { pageIndex } from '../layout/nav.js';
import { CardSkeleton, InlineError } from '../ui/Feedback.jsx';
import { PageHeader } from '../ui/Page.jsx';
import { BackLink } from '../ui/Pill.jsx';
import { Card } from '../ui/Surface.jsx';
import { useToast } from '../ui/toastContext.js';

export default function AddSubscriptionPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [options, setOptions] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getCategories(), getServices(), getPreferences().catch(() => null)])
      .then(([cats, svcs, prefs]) => {
        const firstService = svcs[0];
        setOptions({
          categories: cats,
          defaults: {
            billingCycle: 'Monthly',
            categoryId: firstService?.defaultCategoryId || cats[0]?.id || '',
            cost: '',
            currencyCode: prefs?.preferredCurrency || 'USD',
            customServiceName: '',
            lastUsedDate: '',
            notes: '',
            planName: '',
            renewalDate: '',
            serviceId: firstService?.id || '',
            serviceMode: 'catalog',
            startDate: localToday(),
            status: 'Active',
          },
          services: svcs,
        });
      })
      .catch((err) => setLoadError(getApiErrorMessage(err)));
  }, []);

  async function handleSubmit(values) {
    setError('');
    const payload = toSubscriptionPayload(values, options.services);

    try {
      const created = await createSubscription(payload);
      notify(`${created.serviceName || 'Subscription'} added.`);
      navigate(`/subscriptions/${created.id}`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <BackLink to="/subscriptions">Back to Subscriptions</BackLink>
      <PageHeader
        description="Enter subscription details, pricing, and renewal schedules."
        index={pageIndex('/subscriptions')}
        title="Add New Subscription"
      />
      <Card className="sm:p-8" look="glass">
        {loadError ? (
          <InlineError message={loadError} />
        ) : !options ? (
          <CardSkeleton label="form options" lines={5} tall />
        ) : (
          <SubscriptionForm
            apiError={error}
            cancelTo="/subscriptions"
            categories={options.categories}
            defaultValues={options.defaults}
            onSubmit={handleSubmit}
            services={options.services}
            submitLabel="Create Subscription"
            submittingLabel="Creating…"
          />
        )}
      </Card>
    </div>
  );
}
