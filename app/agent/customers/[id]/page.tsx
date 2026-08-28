import { CustomerProfile } from "@/components/agent/customers/customer-profile"

export default async function CustomerDetailPage(props: PageProps<"/agent/customers/[id]">) {
  const { id } = await props.params
  return <CustomerProfile customerId={id} />
}
