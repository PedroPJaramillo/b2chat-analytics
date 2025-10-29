import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import type { ProcessingStatus } from '@/types/raw-data'

export const dynamic = 'force-dynamic'
export const revalidate = 60 // 1 minute cache

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string | null = null

  try {
    // Authentication check
    const authResult = await auth()
    userId = authResult.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: Add admin authorization check
    // For now, allow all authenticated users

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType') // Optional hint: 'contact' | 'chat'

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    let record: any = null
    let extractMetadata: any = null
    let transformedRecord: any = null
    let recordEntityType: 'contact' | 'chat' | null = null

    // Try to fetch from RawContact or RawChat based on hint or by trying both
    if (!entityType || entityType === 'contact') {
      const rawContact = await prisma.rawContact.findUnique({
        where: { id }
      })

      if (rawContact) {
        recordEntityType = 'contact'
        record = {
          id: rawContact.id,
          entityType: 'contact',
          b2chatId: rawContact.b2chatContactId,
          syncId: rawContact.syncId,
          rawData: rawContact.rawData,
          processingStatus: rawContact.processingStatus as ProcessingStatus,
          fetchedAt: rawContact.fetchedAt.toISOString(),
          processedAt: rawContact.processedAt ? rawContact.processedAt.toISOString() : null,
          apiPage: rawContact.apiPage,
          apiOffset: rawContact.apiOffset,
          processingError: rawContact.processingError,
          processingAttempt: rawContact.processingAttempt,
        }

        // Fetch extract metadata
        const extractLog = await prisma.extractLog.findUnique({
          where: { syncId: rawContact.syncId }
        })

        if (extractLog) {
          extractMetadata = {
            operation: extractLog.operation,
            entityType: extractLog.entityType,
            recordsFetched: extractLog.recordsFetched,
            dateRange: extractLog.dateRangeFrom && extractLog.dateRangeTo ? {
              from: extractLog.dateRangeFrom.toISOString(),
              to: extractLog.dateRangeTo.toISOString(),
            } : undefined,
            startedAt: extractLog.startedAt.toISOString(),
            completedAt: extractLog.completedAt ? extractLog.completedAt.toISOString() : null,
          }
        }

        // If processing completed, fetch transformed contact
        if (rawContact.processingStatus === 'completed') {
          transformedRecord = await prisma.contact.findUnique({
            where: { b2chatId: rawContact.b2chatContactId },
            select: {
              id: true,
              b2chatId: true,
              fullName: true,
              email: true,
              mobile: true,
              phoneNumber: true,
              company: true,
              tags: true,
              customAttributes: true,
              createdAt: true,
              updatedAt: true,
            }
          })
        }
      }
    }

    // If not found in contacts or hint is 'chat', try RawChat
    if (!record && (!entityType || entityType === 'chat')) {
      const rawChat = await prisma.rawChat.findUnique({
        where: { id }
      })

      if (rawChat) {
        recordEntityType = 'chat'
        record = {
          id: rawChat.id,
          entityType: 'chat',
          b2chatId: rawChat.b2chatChatId,
          syncId: rawChat.syncId,
          rawData: rawChat.rawData,
          processingStatus: rawChat.processingStatus as ProcessingStatus,
          fetchedAt: rawChat.fetchedAt.toISOString(),
          processedAt: rawChat.processedAt ? rawChat.processedAt.toISOString() : null,
          apiPage: rawChat.apiPage,
          apiOffset: rawChat.apiOffset,
          processingError: rawChat.processingError,
          processingAttempt: rawChat.processingAttempt,
        }

        // Fetch extract metadata
        const extractLog = await prisma.extractLog.findUnique({
          where: { syncId: rawChat.syncId }
        })

        if (extractLog) {
          extractMetadata = {
            operation: extractLog.operation,
            entityType: extractLog.entityType,
            recordsFetched: extractLog.recordsFetched,
            dateRange: extractLog.dateRangeFrom && extractLog.dateRangeTo ? {
              from: extractLog.dateRangeFrom.toISOString(),
              to: extractLog.dateRangeTo.toISOString(),
            } : undefined,
            startedAt: extractLog.startedAt.toISOString(),
            completedAt: extractLog.completedAt ? extractLog.completedAt.toISOString() : null,
          }
        }

        // If processing completed, fetch transformed chat
        if (rawChat.processingStatus === 'completed') {
          transformedRecord = await prisma.chat.findUnique({
            where: { b2chatId: rawChat.b2chatChatId },
            select: {
              id: true,
              b2chatId: true,
              status: true,
              priority: true,
              topic: true,
              tags: true,
              createdAt: true,
              closedAt: true,
              lastModifiedAt: true,
              agent: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                }
              },
              contact: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                }
              }
            }
          })
        }
      }
    }

    if (!record) {
      return NextResponse.json(
        { error: 'Raw data record not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      record,
      extractMetadata,
      transformedRecord,
    })
  } catch (error) {
    logger.error('Error fetching raw data record', {
      userId: userId ?? undefined,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      { error: 'Failed to fetch raw data record' },
      { status: 500 }
    )
  }
}
