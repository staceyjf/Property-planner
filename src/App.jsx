import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzyErTeXGfcFGExqiBqeAyTAyqKU4LGhH_zzp97OceGt2YxK1Ss72zq7K-7xxCKTr7P/exec'

const initialScenario = {
  name: '',
  purchasePrice: '',
  deposit: '',
  interestRate: '',
  loanTermYears: '',
  stampDuty: '',
  legalFees: '',
  otherUpfront: '',
  weeklyRent: '',
  councilRates: '',
  insurance: '',
  maintenance: '',
  propertyManagement: '',
  otherRunning: '',
}

function n(v) {
  return parseFloat(v) || 0
}

function fmtAUD(amount) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(amount)
}

function calcMortgage(principal, annualRatePct, termYears) {
  if (principal <= 0 || annualRatePct <= 0 || termYears <= 0) {
    return { monthly: 0, totalInterest: 0, schedule: [] }
  }
  const r = annualRatePct / 100 / 12
  const payments = termYears * 12
  const monthly = (principal * r * Math.pow(1 + r, payments)) / (Math.pow(1 + r, payments) - 1)
  const totalInterest = monthly * payments - principal

  let balance = principal
  const schedule = []
  for (let yr = 1; yr <= termYears; yr++) {
    let yInt = 0
    let yPrin = 0
    for (let m = 0; m < 12; m++) {
      const intPmt = balance * r
      const prinPmt = Math.min(monthly - intPmt, balance)
      yInt += intPmt
      yPrin += prinPmt
      balance = Math.max(0, balance - prinPmt)
    }
    schedule.push({
      year: `Yr ${yr}`,
      Interest: Math.round(yInt),
      Principal: Math.round(yPrin),
    })
  }
  return { monthly, totalInterest, schedule }
}

function Field({ label, id, name, suffix, step = '1', value, onChange, type = 'number' }) {
  return (
    <div className="field">
      <label htmlFor={id || name}>{label}</label>
      <div className="field-wrap">
        {type === 'number' && !suffix && <span className="field-adorn">$</span>}
        <input
          id={id || name}
          name={name}
          type={type}
          min={type === 'number' ? '0' : undefined}
          step={type === 'number' ? step : undefined}
          value={value}
          onChange={onChange}
          placeholder={type === 'number' ? '0' : ''}
        />
        {suffix && <span className="field-adorn field-adorn--right">{suffix}</span>}
      </div>
    </div>
  )
}

export default function App() {
  const [scenario, setScenario] = useState(initialScenario)
  const [saveStatus, setSaveStatus] = useState('idle')

  const handleChange = (e) => {
    const { name, value } = e.target
    setScenario((prev) => ({ ...prev, [name]: value }))
  }

  const purchasePrice = n(scenario.purchasePrice)
  const deposit = n(scenario.deposit)
  const loanAmount = Math.max(0, purchasePrice - deposit)
  const lvr = purchasePrice > 0 ? (loanAmount / purchasePrice) * 100 : 0

  const { monthly, totalInterest, schedule } = calcMortgage(
    loanAmount,
    n(scenario.interestRate),
    n(scenario.loanTermYears),
  )

  const totalUpfront =
    purchasePrice + n(scenario.stampDuty) + n(scenario.legalFees) + n(scenario.otherUpfront)
  const annualRent = n(scenario.weeklyRent) * 52
  const annualRunning =
    n(scenario.councilRates) +
    n(scenario.insurance) +
    n(scenario.maintenance) +
    n(scenario.propertyManagement) +
    n(scenario.otherRunning)
  const annualMortgage = monthly * 12
  const annualCashFlow = annualRent - annualRunning - annualMortgage
  const grossYield = purchasePrice > 0 ? (annualRent / purchasePrice) * 100 : 0
  const netYield = purchasePrice > 0 ? ((annualRent - annualRunning) / purchasePrice) * 100 : 0

  const handleSave = async () => {
    setSaveStatus('saving')
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          ...scenario,
          loanAmount: loanAmount.toFixed(2),
          lvr: lvr.toFixed(2),
          monthlyRepayment: monthly.toFixed(2),
          totalInterest: totalInterest.toFixed(2),
          totalUpfront: totalUpfront.toFixed(2),
          annualCashFlow: annualCashFlow.toFixed(2),
          grossYield: grossYield.toFixed(2),
          netYield: netYield.toFixed(2),
          savedAt: new Date().toISOString(),
        }),
      })
      setSaveStatus('success')
    } catch {
      setSaveStatus('error')
    } finally {
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const saveLabel = {
    idle: 'Save Scenario',
    saving: 'Saving…',
    success: 'Saved!',
    error: 'Error — try again',
  }[saveStatus]

  return (
    <div className="app">
      <header className="app-header">
        <h1>Property Scenario Planner</h1>
        <p>Model your property purchase and investment scenarios</p>
      </header>

      <main className="app-main">
        {/* Scenario name */}
        <section className="card">
          <h2>Scenario</h2>
          <Field
            label="Scenario Name"
            name="name"
            type="text"
            value={scenario.name}
            onChange={handleChange}
          />
        </section>

        <div className="two-col">
          {/* Purchase details */}
          <section className="card">
            <h2>Purchase Details</h2>
            <Field label="Purchase Price" name="purchasePrice" value={scenario.purchasePrice} onChange={handleChange} />
            <Field label="Deposit" name="deposit" value={scenario.deposit} onChange={handleChange} />
            <Field label="Stamp Duty" name="stampDuty" value={scenario.stampDuty} onChange={handleChange} />
            <Field label="Legal / Conveyancing Fees" name="legalFees" value={scenario.legalFees} onChange={handleChange} />
            <Field label="Other Upfront Costs" name="otherUpfront" value={scenario.otherUpfront} onChange={handleChange} />
          </section>

          {/* Loan details */}
          <section className="card">
            <h2>Loan Details</h2>
            <Field
              label="Interest Rate (p.a.)"
              name="interestRate"
              suffix="%"
              step="0.01"
              value={scenario.interestRate}
              onChange={handleChange}
            />
            <Field
              label="Loan Term"
              name="loanTermYears"
              suffix="yrs"
              value={scenario.loanTermYears}
              onChange={handleChange}
            />

            <h2 style={{ marginTop: '1.5rem' }}>Rental Income</h2>
            <Field label="Weekly Rent" name="weeklyRent" value={scenario.weeklyRent} onChange={handleChange} />

            <h2 style={{ marginTop: '1.5rem' }}>Annual Running Costs</h2>
            <Field label="Council Rates" name="councilRates" value={scenario.councilRates} onChange={handleChange} />
            <Field label="Insurance" name="insurance" value={scenario.insurance} onChange={handleChange} />
            <Field label="Maintenance" name="maintenance" value={scenario.maintenance} onChange={handleChange} />
            <Field label="Property Management" name="propertyManagement" value={scenario.propertyManagement} onChange={handleChange} />
            <Field label="Other Costs" name="otherRunning" value={scenario.otherRunning} onChange={handleChange} />
          </section>
        </div>

        {/* Summary metrics */}
        <section className="card">
          <h2>Summary</h2>
          <div className="metrics-grid">
            <Metric label="Loan Amount" value={fmtAUD(loanAmount)} />
            <Metric label="LVR" value={`${lvr.toFixed(1)}%`} />
            <Metric label="Monthly Repayment" value={fmtAUD(monthly)} />
            <Metric label="Total Interest Paid" value={fmtAUD(totalInterest)} />
            <Metric label="Total Upfront Cost" value={fmtAUD(totalUpfront)} />
            <Metric
              label="Annual Cash Flow"
              value={fmtAUD(annualCashFlow)}
              className={annualCashFlow >= 0 ? 'positive' : 'negative'}
            />
            <Metric label="Gross Yield" value={`${grossYield.toFixed(2)}%`} />
            <Metric label="Net Yield" value={`${netYield.toFixed(2)}%`} />
          </div>
        </section>

        {/* Amortisation chart */}
        {schedule.length > 0 && (
          <section className="card">
            <h2>Annual Repayment Breakdown</h2>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={schedule} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 11 }}
                  interval={Math.max(0, Math.floor(schedule.length / 10) - 1)}
                />
                <YAxis
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11 }}
                  width={56}
                />
                <Tooltip formatter={(v) => fmtAUD(v)} />
                <Legend />
                <Bar dataKey="Principal" stackId="a" fill="var(--color-principal)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Interest" stackId="a" fill="var(--color-interest)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}

        <div className="actions">
          <button
            className={`save-btn save-btn--${saveStatus}`}
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
          >
            {saveLabel}
          </button>
        </div>
      </main>
    </div>
  )
}

function Metric({ label, value, className }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className={`metric-value ${className || ''}`}>{value}</span>
    </div>
  )
}
