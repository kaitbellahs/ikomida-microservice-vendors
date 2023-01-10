import { Utils, DBModels, Types, Domain } from '@ikomida/shared-backend'
import { Validations } from '@ikomida/shared-logics'
import { Classes } from '@ikomida/shared-types'

export default class App {
  logger
  googleAdmin

  constructor(logger: Utils.Logger) {
    this.logger = logger
    this.googleAdmin = new Utils.GoogleAdmin(this.logger)
  }

  async getApp(identity: Types.Classes.CUser, query?: Types.Interfaces.IMetadata) {
    if (!identity?.ikomidaID && !Validations.validateUUID(query?.contractId)) {
      throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_PRODUCTS_SERVICE_GET_PRODUCTS_INVALID_CONTRACT)
    }
    const include: Domain.SqlDB.Includeable[] = [
      {
        model: DBModels.AppModel,
        required: false
      }
    ]
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
        Types.Types.TRoles.isInternal(identity.role) && Validations.validateUUID(query?.contractId)
          ? {
            id: query?.contractId
          }
          : {
            ikomidaID: identity?.ikomidaID
          },
      include
    })
    if (!contractModel) {
      const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_GET_LAYOUTS_INVALID_CONTRACT)
      return error.logAndReturn(this.logger)
    }
    const appsModel = contractModel?.apps
    if (!appsModel) {
      const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_GET_LAYOUTS_EMPTY)
      return error.logAndReturn(this.logger)
    }

    const apps: Types.Classes.CApp[] = appsModel.map(appModel => {
      return Types.Classes.CApp.init(
        appModel.bundleId ?? '',
        appModel.displayName ?? '',
        appModel.platform ?? '-',
        undefined,
        appModel.version,
        undefined,
        appModel.storePublishStatus,
        appModel.active,
        undefined,
        undefined,
        undefined,
        undefined,
        appModel.storeVersion,
        undefined,
        undefined,
        appModel.icon,
        appModel.description,
        appModel.androidLink,
        appModel.iosLink,
        appModel.id
      )
    })

    return new Classes.Return(true, apps)
  }

  async updateApp(identity: Types.Classes.CUser, input: any, query?: Types.Interfaces.IMetadata) {
    try {
      const payload: Types.Classes.CApp[] = Types.Classes.CApp.fromObject(input)
      if (payload.length === 0) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_SET_LAYOUTS_MISSING_DATA)
        return error.logAndReturn(this.logger)
      }
      if (!identity?.ikomidaID && !Validations.validateUUID(query?.contractId)) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_PRODUCTS_SERVICE_GET_PRODUCTS_INVALID_CONTRACT)
      }
      const app = payload.filter(app => {
        return app.icon || app.description
      })?.[0]
      if (!app) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_SET_LAYOUTS_MISSING_DATA)
        return error.logAndReturn(this.logger)
      }
      const include: Domain.SqlDB.Includeable[] = [
        {
          model: DBModels.AppModel,
          required: true
        }
      ]
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
          Types.Types.TRoles.isInternal(identity.role) && Validations.validateUUID(query?.contractId)
            ? {
              id: query?.contractId
            }
            : {
              ikomidaID: identity?.ikomidaID
            },
        include
      })
      if (!contractModel) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_SET_LAYOUT_INVALID_CONTRACT)
        return error.logAndReturn(this.logger)
      }
      const appsModel = contractModel?.apps
      if (!appsModel) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_SET_LAYOUT_EMPTY)
        return error.logAndReturn(this.logger)
      }
      const icon = await this.googleAdmin.uploadToStorage(
        identity,
        'appIcon',
        'image',
        'vendorAppIcon',
        app.icon,
        app.icon
      )
      for (const appModel of appsModel) {
        appModel.icon = icon
        appModel.description = app.description
        await appModel.save()
      }
      return new Classes.Return(true, null)
    } catch (exception: any) {
      const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_SET_LAYOUT_EXCEPTION, exception)
      return error.logAndReturn(this.logger)
    }
  }
}
