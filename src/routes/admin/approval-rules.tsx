import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { getApprovalRules, updateApprovalRule } from '~/server/functions/config'

export const Route = createFileRoute('/admin/approval-rules')({
  component: AdminApprovalRules,
  loader: () => getApprovalRules(),
})

function AdminApprovalRules() {
  const rules = Route.useLoaderData()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Approval Rules</h1>
      <p className="text-sm text-gray-500 mb-6">
        Configure the attestation thresholds per approval level. A deal requires the lowest level
        whose thresholds are met.
      </p>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Display Name</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Max Payback (months)</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Min TB2 Margin</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Max Value (MSEK)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rules.map((rule) => (
              <ApprovalRuleRow key={rule.id} rule={rule} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-sm font-semibold text-blue-900 mb-1">How approval works</h3>
        <p className="text-sm text-blue-700">
          The system checks each level from top (lowest authority) to bottom (highest).
          A deal requires approval from the first level that can accommodate its payback time,
          margin, and total contract value.
        </p>
      </div>
    </div>
  )
}

function ApprovalRuleRow({ rule }: { rule: any }) {
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState({
    maxPaybackMonths: rule.maxPaybackMonths?.toString() ?? '',
    minContributionMargin: rule.minContributionMargin?.toString() ?? '',
    maxContractValueMsek: rule.maxContractValueMsek?.toString() ?? '',
  })

  const handleSave = async () => {
    await updateApprovalRule({
      data: {
        id: rule.id,
        updates: {
          maxPaybackMonths: values.maxPaybackMonths ? Number(values.maxPaybackMonths) : null,
          minContributionMargin: values.minContributionMargin ? Number(values.minContributionMargin) : null,
          maxContractValueMsek: values.maxContractValueMsek ? Number(values.maxContractValueMsek) : null,
        },
      },
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <tr className="bg-blue-50/50">
        <td className="px-4 py-2 text-sm font-medium text-gray-900">{rule.level}</td>
        <td className="px-4 py-2 text-sm text-gray-700">{rule.displayName}</td>
        <td className="px-4 py-2">
          <input type="number" value={values.maxPaybackMonths}
            onChange={(e) => setValues({ ...values, maxPaybackMonths: e.target.value })}
            className="w-20 px-2 py-1 border rounded text-sm text-right font-mono" placeholder="∞" />
        </td>
        <td className="px-4 py-2">
          <input type="number" step="0.01" value={values.minContributionMargin}
            onChange={(e) => setValues({ ...values, minContributionMargin: e.target.value })}
            className="w-20 px-2 py-1 border rounded text-sm text-right font-mono" placeholder="∞" />
        </td>
        <td className="px-4 py-2">
          <input type="number" value={values.maxContractValueMsek}
            onChange={(e) => setValues({ ...values, maxContractValueMsek: e.target.value })}
            className="w-20 px-2 py-1 border rounded text-sm text-right font-mono" placeholder="∞" />
        </td>
        <td className="px-4 py-2">
          <div className="flex gap-1">
            <button onClick={handleSave} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">Save</button>
            <button onClick={() => setEditing(false)} className="px-2 py-1 text-gray-500 text-xs">Cancel</button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setEditing(true)}>
      <td className="px-4 py-3 text-sm font-medium text-gray-900">{rule.level}</td>
      <td className="px-4 py-3 text-sm text-gray-700">{rule.displayName}</td>
      <td className="px-4 py-3 text-sm text-right font-mono text-gray-700">
        {rule.maxPaybackMonths !== null ? `${rule.maxPaybackMonths}` : '∞'}
      </td>
      <td className="px-4 py-3 text-sm text-right font-mono text-gray-700">
        {rule.minContributionMargin !== null ? `${(rule.minContributionMargin * 100).toFixed(0)}%` : '∞'}
      </td>
      <td className="px-4 py-3 text-sm text-right font-mono text-gray-700">
        {rule.maxContractValueMsek !== null ? `${rule.maxContractValueMsek}` : '∞'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{rule.ruleType}</td>
    </tr>
  )
}
