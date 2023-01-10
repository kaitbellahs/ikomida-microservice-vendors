import { Domain, Utils, DBModels, Types, Logics } from '@ikomida/shared-backend'
import { Validations } from '@ikomida/shared-logics'
import { Classes } from '@ikomida/shared-types'

export default class Layout {
  logger
  constructor(logger: Utils.Logger) {
    this.logger = logger
  }
  async getLayout(ikomidaID: string, query?: Types.Interfaces.IMetadata) {
    if (!ikomidaID && !Validations.validateUUID(query?.contractId)) {
      throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_PRODUCTS_SERVICE_GET_PRODUCTS_INVALID_CONTRACT)
    }
    const include: Domain.SqlDB.Includeable[] = [
      {
        model: DBModels.VendorSettingsModel,
        required: false
      }
    ]
    const contractModel = await DBModels.ContractModel.findOne({
      where:
        Validations.validateUUID(query?.contractId)
          ? {
            id: query?.contractId
          }
          : {
            ikomidaID
          },
      include
    })
    if (!contractModel) {
      const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_GET_LAYOUTS_INVALID_CONTRACT)
      return error.logAndReturn(this.logger)
    }
    const vendorSettingsModel = contractModel?.vendorSettings
    if (!vendorSettingsModel) {
      const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_GET_LAYOUTS_EMPTY)
      return error.logAndReturn(this.logger)
    }

    return new Classes.Return(true, Types.Classes.CLayout.fromObject(vendorSettingsModel?.layout))
  }

  async setLayout(identity: Types.Classes.CUser, input: any, query?: Types.Interfaces.IMetadata) {
    try {
      const payload: Types.Classes.CLayout = Types.Classes.CLayout.fromObject(input)
      if (!identity?.ikomidaID && !Validations.validateUUID(query?.contractId)) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_PRODUCTS_SERVICE_GET_PRODUCTS_INVALID_CONTRACT)
      }
      // if (!payload.validate()) {
      //   const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_SET_LAYOUTS_MISSING_DATA)
      //   return error.logAndReturn(this.logger)
      // }
      const include: Domain.SqlDB.Includeable[] = [
        {
          model: DBModels.VendorSettingsModel,
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
      const vendorSettingsModel = contractModel?.vendorSettings
      if (!vendorSettingsModel) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_SET_LAYOUT_EMPTY)
        return error.logAndReturn(this.logger)
      }
      vendorSettingsModel.layout = payload.toJSON()
      await vendorSettingsModel.save()
      return new Classes.Return(true, null)
    } catch (exception: any) {
      const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_SET_LAYOUT_EXCEPTION, exception)
      return error.logAndReturn(this.logger)
    }
  }
}
