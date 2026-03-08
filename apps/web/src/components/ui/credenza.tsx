import * as React from "react"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

interface BaseProps {
  children: React.ReactNode
}

interface RootCredenzaProps extends BaseProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface CredenzaProps extends BaseProps {
  className?: string
  asChild?: true
}

const CredenzaContext = React.createContext<{ isMobile: boolean }>({
  isMobile: false,
})

const useCredenzaContext = () => {
  const context = React.useContext(CredenzaContext)
  if (!context) {
    throw new Error(
      "Credenza components cannot be rendered outside the Credenza Context"
    )
  }
  return context
}

const Credenza = ({ children, ...props }: RootCredenzaProps) => {
  const isMobile = useIsMobile()
  const CredenzaComponent = isMobile ? Drawer : Dialog

  return (
    <CredenzaContext.Provider value={{ isMobile }}>
      <CredenzaComponent
        {...props}
        {...(isMobile && { autoFocus: true })}
      >
        {children}
      </CredenzaComponent>
    </CredenzaContext.Provider>
  )
}

const CredenzaTrigger = ({ className, children, ...props }: CredenzaProps) => {
  const { isMobile } = useCredenzaContext()
  const Trigger = isMobile ? DrawerTrigger : DialogTrigger

  return (
    <Trigger className={className} {...props}>
      {children}
    </Trigger>
  )
}

const CredenzaClose = ({ className, children, ...props }: CredenzaProps) => {
  const { isMobile } = useCredenzaContext()
  const Close = isMobile ? DrawerClose : DialogClose

  return (
    <Close className={className} {...props}>
      {children}
    </Close>
  )
}

const CredenzaContent = ({ className, children, ...props }: CredenzaProps) => {
  const { isMobile } = useCredenzaContext()
  const Content = isMobile ? DrawerContent : DialogContent

  return <Content className={className} {...props}>{children}</Content>
}

const CredenzaDescription = ({
  className,
  children,
  ...props
}: CredenzaProps) => {
  const { isMobile } = useCredenzaContext()
  const Description = isMobile ? DrawerDescription : DialogDescription

  return (
    <Description className={className} {...props}>
      {children}
    </Description>
  )
}

const CredenzaHeader = ({ className, children, ...props }: CredenzaProps) => {
  const { isMobile } = useCredenzaContext()
  const Header = isMobile ? DrawerHeader : DialogHeader

  return (
    <Header className={className} {...props}>
      {children}
    </Header>
  )
}

const CredenzaTitle = ({ className, children, ...props }: CredenzaProps) => {
  const { isMobile } = useCredenzaContext()
  const Title = isMobile ? DrawerTitle : DialogTitle

  return (
    <Title className={className} {...props}>
      {children}
    </Title>
  )
}

const CredenzaBody = ({ className, children, ...props }: CredenzaProps) => {
  return (
    <div className={cn("px-4 md:px-0", className)} {...props}>
      {children}
    </div>
  )
}

const CredenzaFooter = ({ className, children, ...props }: CredenzaProps) => {
  const { isMobile } = useCredenzaContext()
  const Footer = isMobile ? DrawerFooter : DialogFooter

  return (
    <Footer className={className} {...props}>
      {children}
    </Footer>
  )
}

export {
  Credenza,
  CredenzaTrigger,
  CredenzaClose,
  CredenzaContent,
  CredenzaDescription,
  CredenzaHeader,
  CredenzaTitle,
  CredenzaBody,
  CredenzaFooter,
}
