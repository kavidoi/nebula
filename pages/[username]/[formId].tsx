import React from 'react'
import { GetServerSideProps } from 'next'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import FormRunner from '../../components/FormRunner'

type FormRecord = {
  formId: string
  username: string
  apiKey: string
  baseId: string
  tableName: string
  fields: any[]
  isActive: boolean
}

type PublicFormProps = {
  form: FormRecord
  linkedTables: { id: string; name: string }[]
}

const PublicForm = ({ form, linkedTables }: PublicFormProps) => {
  return (
    <FormRunner
      fields={form.fields}
      linkedTables={linkedTables}
      baseTableName={form.tableName}
      apiKey={form.apiKey}
      baseId={form.baseId}
    />
  )
}

export const getServerSideProps: GetServerSideProps<PublicFormProps> = async (context) => {
  const { username, formId } = context.params as { username: string; formId: string }
  const filePath = path.join(process.cwd(), 'data', 'forms', `${username}-${formId}.json`)
  if (!fs.existsSync(filePath)) {
    return { notFound: true }
  }
  const form: FormRecord = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  if (!form.isActive) {
    return { notFound: true }
  }

  let linkedTables: { id: string; name: string }[] = []
  try {
    const res = await axios.get(`http://localhost:${process.env.PORT || 3000}/api/schema`, {
      params: { tableName: form.tableName },
      headers: { 'x-api-key': form.apiKey, 'x-base-id': form.baseId }
    })
    linkedTables = res.data.linkedTables
  } catch (err) {
    console.error('Error fetching schema for public form', err)
  }

  return {
    props: {
      form,
      linkedTables
    }
  }
}

export default PublicForm
