import { SoftButtonLink } from '@/components/elements/button'
import { Main } from '@/components/elements/main'
import { LINKS } from '@/lib/links'
import { FAQsTwoColumnAccordion, Faq } from '@/components/sections/faqs-two-column-accordion'
import { Plan, PricingHeroMultiTier } from '@/components/sections/pricing-hero-multi-tier'
import { CTA } from '@/components/shared/cta'
import { Footer } from '@/components/shared/footer'
import { Navbar } from '@/components/shared/navbar'

function plans(option: string) {
  return (
    <>
      <Plan
        name="Personal"
        price="Free"
        subheadline={<p>For individuals and small projects getting started</p>}
        features={['1 user', 'Unlimited connections', 'SQL editor and intellisense', 'Inline data editing', 'Schema inspection', 'AI assistant']}
        cta={
          <SoftButtonLink href={LINKS.quickstart} target="_blank" size="lg">
            Get started
          </SoftButtonLink>
        }
      />
      <Plan
        name="Team"
        price={option === 'Monthly' ? '$20' : '$16'}
        period="/user/month"
        subheadline={<p>For teams who need collaboration</p>}
        features={[
          'Everything in Personal',
          'Unlimited users',
          'User groups',
          'Database access control',
          'Google SSO',
          'Custom banner',
        ]}
        cta={
          <SoftButtonLink href={LINKS.quickstart} target="_blank" size="lg">
            Get started
          </SoftButtonLink>
        }
      />
      <Plan
        name="Enterprise"
        price="Custom"
        subheadline={<p>For organizations that need security and governance</p>}
        features={[
          'Everything in Team',
          'Enterprise SSO (Okta, Keycloak, etc.)',
          'Audit logging',
          'OEM / White-labeling',
          'SOC 2 report',
          'Dedicated support channel',
        ]}
        cta={
          <SoftButtonLink href={LINKS.contact} size="lg">
            Contact us
          </SoftButtonLink>
        }
      />
    </>
  )
}

export default function PricingPage() {
  return (
    <>
      <Navbar />

      <Main>
        {/* Pricing */}
        <PricingHeroMultiTier
          id="pricing"
          headline="Pricing"
          subheadline={
            <p>
              Start in minutes and scale as you grow.
            </p>
          }
          options={['Monthly', 'Yearly']}
          plans={{ Monthly: plans('Monthly'), Yearly: plans('Yearly') }}
        />

        {/* FAQs */}
        <FAQsTwoColumnAccordion id="faqs" headline="Questions & Answers">
          <Faq
            id="faq-1"
            question="Is there a SaaS version?"
            answer="No. pgconsole is self-hosted only. You deploy it on your own infrastructure and keep full control of your data."
          />
          <Faq
            id="faq-2"
            question="What databases are supported?"
            answer="pgconsole is purpose-built for PostgreSQL and supports all major versions. It works with any PostgreSQL-compatible database, including managed services like AWS RDS, Google Cloud SQL, Supabase, and Neon."
          />
          <Faq
            id="faq-3"
            question="Can I try paid plans before committing?"
            answer="We offer a trial for the Enterprise plan. For the Team plan, you can start with the free Personal plan and upgrade when you're ready."
          />
          <Faq
            id="faq-4"
            question="How do I purchase?"
            answer="For the Team plan, purchase directly from the app with a credit card. For Enterprise, we accept wire transfer and AWS Marketplace private offers."
          />
        </FAQsTwoColumnAccordion>

        {/* Call To Action */}
        <CTA />
      </Main>

      <Footer />
    </>
  )
}
