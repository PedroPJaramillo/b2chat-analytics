import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await auth()
    const userId = authResult.userId
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const resolvedParams = await params
    const body = await request.json()
    const { name, email, isActive } = body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (isActive !== undefined) updateData.isActive = isActive

    const agent = await prisma.agent.update({
      where: { id: resolvedParams.id },
      data: updateData
    })

    return NextResponse.json(agent)
  } catch (error) {
    console.error('Error updating agent:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await auth()
    const userId = authResult.userId
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const resolvedParams = await params

    await prisma.agent.delete({
      where: { id: resolvedParams.id }
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting agent:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
