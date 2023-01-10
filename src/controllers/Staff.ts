import { cryptPassword, Domain, Utils, passwordGenerator, Logics, Types, DBModels } from '@ikomida/shared-backend'
import { IiKomidaErrorModel } from '@ikomida/shared-backend/lib/src/Utils/iKomidaError'
import { Classes } from '@ikomida/shared-types'

const host: any = {
  development: 'https://dev.ikomida.com/',
  homologation: 'https://hmlg.ikomida.com/',
  production: 'https://ikomida.com/'
}

export default class Staff {
  randCodes
  limit = 10
  logger
  host

  private IKOMIDA_RESELLER_SERVICE_NEW_STAFF_CANT_SEND_EMAIL: IiKomidaErrorModel = {
    code: 'IMV001',
    message:
      'Não foi possível enviar o email de boas vinda e senha, a operação será cancelada, tente novamente em instante ou nos contate.!'
  }

  constructor(logger: Utils.Logger) {
    this.randCodes = new Utils.RandCodes()
    this.logger = logger
    this.host = host[process.env.NODE_ENV ?? 'development']
  }

  async getStaff(identity: Types.Classes.CUser, timestamp: number, query?: Types.Interfaces.IMetadata) {
    try {
      const role = identity.role
      if (!role || ![Types.Types.TRoles.VENDOR, Types.Types.TRoles.ADMIN].includes(role)) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_GET_RESELLERS_UNAUTHORIZED)
      }
      let staff
      const where =
        timestamp && timestamp != 0 && Number(Logics.Finances.toNumber(timestamp)) == timestamp
          ? {
            createdAt: {
              [Domain.SqlDB.Op.lt]: new Date(Number(Logics.Finances.toNumber(timestamp)))
            }
          }
          : null
      if (Types.Types.TRoles.ADMIN === role && !Logics.Validations.validateUUID(query?.contractId)) {
        const staffModels = await DBModels.UserModel.findAll({
          where: {
            ...{
              role: {
                [Domain.SqlDB.Op.in]: [Types.Types.TRoles.STAFF, Types.Types.TRoles.VENDOR]
              }
            },
            ...where
          },
          order: [['createdAt', 'DESC']],
          limit: this.limit,
          include: [
            {
              model: DBModels.ContractModel,
              required: true
            }
          ]
        })
        staff = staffModels.map(staffModel => {
          return Types.Classes.CUser.init(
            staffModel.role ?? Types.Types.TRoles.STAFF,
            staffModel.name ?? '',
            staffModel.lastName ?? '',
            staffModel.identity ?? '',
            staffModel.email ?? '-',
            staffModel.phone ?? '-',
            String(staffModel.areaCode),
            '',
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            staffModel.avatar,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            staffModel.id,
            staffModel.createdAt.getTime()
          )
        })
      } else {
        if (!identity?.ikomidaID && !Logics.Validations.validateUUID(query?.contractId)) {
          throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_PRODUCTS_SERVICE_GET_PRODUCTS_INVALID_CONTRACT)
        }
        const include: Domain.SqlDB.Includeable[] = []
        if (!Types.Types.TRoles.isInternal(identity.role)) {
          include.push({
            model: DBModels.UserModel,
            required: true,
            where: {
              id: identity.id,
              role: {
                [Domain.SqlDB.Op.in]: [Types.Types.TRoles.VENDOR, Types.Types.TRoles.STAFF]
              }
            }
          })
        }
        const contractModel = await DBModels.ContractModel.findOne({
          where: {
            ikomidaID: identity.ikomidaID
          },
          include
        })
        if ((contractModel?.users?.length ?? 0) !== 1) {
          throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_GET_RESELLER_INVALID_USER)
        }
        const userModels = await contractModel?.$get('users', {
          where: {
            ...where,
            ...{
              role: {
                [Domain.SqlDB.Op.in]: [Types.Types.TRoles.STAFF, Types.Types.TRoles.VENDOR]
              }
            }
          },
          order: [['createdAt', 'DESC']],
          limit: this.limit
        })
        staff = userModels?.map(staffModel => {
          return Types.Classes.CUser.init(
            staffModel.role ?? Types.Types.TRoles.STAFF,
            staffModel.name ?? '',
            staffModel.lastName ?? '',
            staffModel.identity ?? '',
            staffModel.email ?? '-',
            staffModel.phone ?? '-',
            String(staffModel.areaCode),
            '',
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            staffModel.avatar,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            staffModel.id,
            staffModel.createdAt.getTime()
          )
        })
      }
      return new Classes.Return(
        true,
        staff?.sort((item1, item2) => (item2?.timestamp ?? 0) - (item1?.timestamp ?? 0))
      )
    } catch (exception: any) {
      let error = new Utils.iKomidaError(
        Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_GET_RESELLER_EXCEPTION,
        exception?.message
      )
      if (exception instanceof Utils.iKomidaError) {
        error = exception
      }
      return error.logAndReturn(this.logger)
    }
  }

  async newStaff(identity: Types.Classes.CUser, object: any, query?: Types.Interfaces.IMetadata) {
    let transaction: Domain.SqlDB.Transaction | undefined = undefined
    try {
      const staff: Types.Classes.CUser = Types.Classes.CUser.fromObject(object)
      const role = identity.role
      if (!role || ![Types.Types.TRoles.VENDOR, Types.Types.TRoles.ADMIN].includes(role)) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_UNAUTHORIZED)
      }
      if (!identity?.ikomidaID && !Logics.Validations.validateUUID(query?.contractId)) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_PRODUCTS_SERVICE_GET_PRODUCTS_INVALID_CONTRACT)
      }
      //TODO: add validation
      if (!Types.Types.TRoles.vendors.includes(staff.role)) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_MISSING_DATA)
        return error.logAndReturn(this.logger)
      }
      const include: Domain.SqlDB.Includeable[] = [
        {
          model: DBModels.PlanModel,
          required: true
        }
      ]
      if (!Types.Types.TRoles.isInternal(identity.role)) {
        include.push({
          model: DBModels.UserModel,
          where: {
            id: identity.id,
            role: {
              [Domain.SqlDB.Op.in]: Types.Types.TRoles.vendors
            }
          },
          required: true
        })
      }
      const contractModel = await DBModels.ContractModel.findOne({
        where:
          Types.Types.TRoles.isInternal(identity.role) && Logics.Validations.validateUUID(query?.contractId)
            ? {
              id: query?.contractId
            }
            : {
              ikomidaID: identity?.ikomidaID
            },
        include
      })
      if ((contractModel?.users?.length ?? 0) !== 1) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_INVALID_USER)
      }
      let countUsers = await contractModel?.$count('users', {
        where: {
          role: {
            [Domain.SqlDB.Op.in]: [Types.Types.TRoles.VENDOR, Types.Types.TRoles.STAFF]
          }
        }
      })
      const staffLimit = contractModel?.plan?.staff ?? -1
      if (staffLimit !== -1 && (countUsers ?? 0) >= staffLimit) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_NEW_STAFF_LIMIT_EXCEEDED, staffLimit)
      }
      countUsers = await contractModel?.$count('users', {
        where: {
          role: {
            [Domain.SqlDB.Op.in]: Types.Types.TRoles.vendors
          },
          [Domain.SqlDB.Op.or]: [
            {
              email: staff?.email
            },
            {
              areaCode: Logics.Finances.toNumber(staff?.areaCode),
              phone: Logics.Finances.toNumber(staff?.phone)
            },
            {
              identity: Logics.Finances.toNumber(staff?.identity)
            }
          ]
        }
      })
      if (countUsers !== 0) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_USED_USER)
      }
      const newPassword = passwordGenerator(8)
      transaction = await Domain.SqlDB.sequelize.transaction({
        autocommit: false
      })
      const userModel: DBModels.UserModel | undefined = await contractModel?.$create(
        'user',
        {
          role: staff.role,
          name: staff.name,
          lastName: staff.lastName,
          email: staff.email,
          identity: Logics.Finances.toNumber(staff.identity),
          phone: Logics.Finances.toNumber(staff.phone),
          areaCode: Logics.Finances.toNumber(staff.areaCode),
          password: (await cryptPassword(newPassword)).hash
        },
        { transaction }
      )
      if (!userModel || !userModel.email) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_CREATE_USER_DB_ERROR)
      }
      try {
        const message = new Utils.Email(
          Utils.Email.STAFF_REGISTRATION_SUCCESSFULL,
          'iKomida dashboard',
          userModel?.name,
          contractModel?.contractName,
          `${this.host}/apps`,
          contractModel?.ikomidaID,
          userModel?.phone,
          newPassword,
          this.host,
          'iKomida'
        )
        await Utils.Email.sendEmail(
          this.logger,
          userModel.email,
          `${userModel.name} ${userModel.lastName}`,
          message,
          'iKomida dashboard'
        )
      } catch (exception: any) {
        throw new Utils.iKomidaError(this.IKOMIDA_RESELLER_SERVICE_NEW_STAFF_CANT_SEND_EMAIL, exception)
      }
      await transaction.commit()
      return new Classes.Return(true)
    } catch (exception: any) {
      await transaction?.rollback()
      let error = new Utils.iKomidaError(
        Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_EXCEPTION,
        exception?.message
      )
      if (exception instanceof Utils.iKomidaError) {
        error = exception
      }
      return error.logAndReturn(this.logger)
    }
  }

  async removeStaff(identity: Types.Classes.CUser, id: string, query?: Types.Interfaces.IMetadata) {
    try {
      const role = identity.role
      if (!role || ![Types.Types.TRoles.VENDOR, Types.Types.TRoles.ADMIN].includes(role)) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_UNAUTHORIZED)
      }
      if (!Logics.Validations.validateUUID(id)) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_MISSING_DATA)
      }
      if (!identity?.ikomidaID && !Logics.Validations.validateUUID(query?.contractId)) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_PRODUCTS_SERVICE_GET_PRODUCTS_INVALID_CONTRACT)
      }

      const include: Domain.SqlDB.Includeable[] = []
      if (!Types.Types.TRoles.isInternal(identity.role)) {
        include.push({
          model: DBModels.UserModel,
          required: true,
          where: {
            id: identity.id,
            role: {
              [Domain.SqlDB.Op.in]: [Types.Types.TRoles.VENDOR, Types.Types.TRoles.STAFF]
            }
          }
        })
      }
      const contractModel = await DBModels.ContractModel.findOne({
        where:
          Types.Types.TRoles.isInternal(identity.role) && Logics.Validations.validateUUID(query?.contractId)
            ? {
              id: query?.contractId
            }
            : {
              ikomidaID: identity?.ikomidaID
            },
        include
      })
      if ((contractModel?.users?.length ?? 0) !== 1) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_INVALID_USER)
      }
      const staffModels = await contractModel?.$get('users', {
        where: {
          [Domain.SqlDB.Op.and]: [{ id: { [Domain.SqlDB.Op.not]: identity.id } }, { id }]
        }
      })
      if ((staffModels?.length ?? 0) !== 1) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_INVALID_USER)
      }
      await staffModels?.[0].destroy()
      return new Classes.Return(true)
    } catch (exception: any) {
      let error = new Utils.iKomidaError(
        Utils.iKomidaError.IKOMIDA_ADMIN_SERVICE_DELETE_SETTING_EXCEPTION,
        exception?.message
      )
      if (exception instanceof Utils.iKomidaError) {
        error = exception
      }
      return error.logAndReturn(this.logger)
    }
  }

  // async countStaffs(identity: Types.Classes.CUser) {
  //     const bonusLevels = [5, 3, 1]
  //     try {
  //         if (![Types.Types.TRoles.VENDOR, Types.Types.TRoles.ADMIN].includes(identity.role)) {
  //             const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_UNAUTHORIZED)
  //             return error.logAndReturn(this.logger)
  //         }
  //         const currentUserModel = await DBModels.UserModel.findOne({
  //             where: {
  //                 id: identity.id
  //             }
  //         })
  //         if (!currentUserModel) {
  //             const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_INVALID_USER)
  //             return error.logAndReturn(this.logger)
  //         }
  //         const referral = await currentUserModel.getReferral()
  //         let usersByReferral = await referral.getReferredBy()
  //         let referralCount = [];
  //         for (let index = 0; index <= bonusLevels.length; index++) {
  //             let newUsersByReferral = []
  //             for (const userByReferral of usersByReferral) {
  //                 const userReferral = await userByReferral.getReferral()
  //                 newUsersByReferral = [...newUsersByReferral, ...await userReferral.getReferredBy()]
  //             }
  //             referralCount.push({ level: index, count: usersByReferral.length })
  //             usersByReferral = newUsersByReferral
  //         }
  //         return new Classes.Return(true, referralCount)
  //     } catch (exception: any) {
  //         const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_EXCEPTION, exception?.message)
  //         return error.logAndReturn(this.logger)
  //     }
  // }
}
