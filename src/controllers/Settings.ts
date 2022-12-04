import {
  GateWays,
  Domain,
  Utils,
  Logics,
  BackendTypes,
  Types,
  Helpers,
  DBModels,
  objHasProp
} from '@ikomida/shared-backend'

export default class Settings {
  logger
  googleAdmin

  constructor(logger: Utils.Logger) {
    this.logger = logger
    this.googleAdmin = new Utils.GoogleAdmin(this.logger)
  }

  async getSettings(identity: Types.Classes.CUser) {
    try {
      const contractModel = await DBModels.ContractModel.findOne({
        where: {
          ikomidaID: identity.ikomidaID
        },
        include: [
          {
            model: DBModels.AddressModel,
            where: {
              role: Types.Types.TRoles.VENDOR
            },
            required: false,
            order: [['createdAt', 'DESC']],
            limit: 1
          },
          {
            model: DBModels.UserModel,
            required: true,
            where: {
              id: identity.id,
              role: {
                [Domain.SqlDB.Op.in]: [Types.Types.TRoles.VENDOR, Types.Types.TRoles.STAFF]
              }
            }
          },
          {
            model: DBModels.VendorSettingsModel,
            required: false,
            include: [
              {
                model: DBModels.VendorPaymentGatewayModel,
                required: false
              }
            ]
          }
        ]
      })
      if (!contractModel) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_GET_SETTINGS_INVALID_CONTRACT)
        return error.logAndReturn(this.logger)
      }
      const vendorSettingsModel = contractModel?.vendorSettings
      if (!vendorSettingsModel) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_GET_SETTINGS_EMPTY)
        return error.logAndReturn(this.logger)
      }
      const addressModel = contractModel?.addresses?.[0]
      const vendorPaymentGatewayModel = vendorSettingsModel?.vendorPaymentGateway
      const object: Types.Classes.CVendorSettings = Types.Classes.CVendorSettings.fromObject({
        profile: Types.Classes.CVendorProfile.init(
          vendorSettingsModel?.areaCode ?? 0,
          contractModel?.contractName ?? '-',
          contractModel?.contractIdentity ?? '-',
          contractModel?.identity ?? '-',
          vendorSettingsModel?.phone ?? '-',
          vendorSettingsModel?.email ?? '-',
          Types.Classes.CAddress.init(
            addressModel?.postalCode ?? '-',
            addressModel?.street ?? '-',
            addressModel?.neighborhood ?? '-',
            addressModel?.city ?? '-',
            addressModel?.stat ?? '-',
            addressModel?.number,
            addressModel?.complement,
            addressModel?.kind,
            addressModel?.reference,
            undefined,
            undefined,
            undefined,
            Types.Classes.CLocation.fromObject({
              latitude: addressModel?.coordinates?.coordinates?.[0],
              longitude: addressModel?.coordinates?.coordinates?.[1]
            })
          ),
          vendorSettingsModel?.restaurantImage
        ),
        paymentGateway: Types.Classes.CVendorPaymentGateway.init(
          vendorPaymentGatewayModel?.gateway ?? '',
          vendorPaymentGatewayModel?.data ? true : false
        ),
        business: Types.Classes.CBusinessTime.fromObject({
          hours: vendorSettingsModel?.businessHours,
          days: vendorSettingsModel?.businessDays
        }),
        delivery: Types.Classes.CVendorDelivery.init(
          vendorSettingsModel?.deliveryFree ?? false,
          vendorSettingsModel?.delivery ?? 0,
          vendorSettingsModel?.orderMinValue ?? 0,
          vendorSettingsModel?.deliveryMin ?? 0
        ),
        preparation: Types.Classes.CVendorPreparation.init(
          vendorSettingsModel?.preparationMin ?? 0,
          vendorSettingsModel?.preparationMax ?? 0
        ),
        orderTypes: vendorSettingsModel?.orderTypes,
        tip: vendorSettingsModel?.tip
      })
      return new Utils.Return(true, object)
    } catch (exception: any) {
      const error = new Utils.iKomidaError(
        Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_UPDATE_PROFILE_UPLOAD_Image_EXCEPTION,
        exception
      )
      return error.logAndReturn(this.logger)
    }
  }

  async getPagSeguroURL(identity: Types.Classes.CUser) {
    const contractModel = await DBModels.ContractModel.findOne({
      where: {
        [Domain.SqlDB.Op.and]: [
          {
            ikomidaID: identity.ikomidaID
          },
          {
            ikomidaID: {
              [Domain.SqlDB.Op.not]: 'com.ikomida.br.demo'
            }
          }
        ]
      },
      include: [
        {
          model: DBModels.UserModel,
          required: true,
          where: {
            id: identity.id,
            role: {
              [Domain.SqlDB.Op.in]: [Types.Types.TRoles.VENDOR]
            }
          }
        }
      ]
    })
    if (!contractModel) {
      const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_GET_PAGSEGURO_URL_INVALID_CONTRACT)
      return error.logAndReturn(this.logger)
    }
    const pagseguroHelper = new Helpers.PagseguroHelper(this.logger)
    const paymentGateway = await pagseguroHelper.configure()
    if (!paymentGateway) {
      const error = new Utils.iKomidaError(
        Utils.iKomidaError.IKOMIDA_PAYMENTS_SERVICE_PROCESS_PAYMENT_INVALID_VENDOR_PAYMENT_SETTINGS
      )
      return error.logAndReturn(this.logger)
    }
    const url = paymentGateway?.generateConnectUrl(contractModel?.ikomidaID)
    return new Utils.Return(url !== null, {
      url
    })
  }

  async updateProfile(identity: Types.Classes.CUser, input: any) {
    let transaction: Domain.SqlDB.Transaction | undefined = undefined
    try {
      const payload: Types.Classes.CVendorProfile = Types.Classes.CVendorProfile.fromObject(input)
      if (!payload.validate()) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_UPDATE_PROFILE_MISSING_DATA)
        return error.logAndReturn(this.logger)
      }
      const contractModel = await DBModels.ContractModel.findOne({
        where: {
          ikomidaID: identity.ikomidaID
        },
        include: [
          {
            model: DBModels.AddressModel,
            where: {
              role: Types.Types.TRoles.VENDOR
            },
            required: false,
            order: [['createdAt', 'DESC']],
            limit: 1
          },
          {
            model: DBModels.UserModel,
            required: true,
            where: {
              id: identity.id,
              role: {
                [Domain.SqlDB.Op.in]: [Types.Types.TRoles.VENDOR]
              }
            }
          },
          {
            model: DBModels.VendorSettingsModel,
            required: true
          }
        ]
      })
      if (!contractModel) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_UPDATE_PROFILE_INVALID_CONTRACT)
        return error.logAndReturn(this.logger)
      }
      const vendorSettingsModel = contractModel?.vendorSettings
      if (!vendorSettingsModel) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_UPDATE_PROFILE_EMPTY)
        return error.logAndReturn(this.logger)
      }
      vendorSettingsModel.email = payload?.email
      vendorSettingsModel.phone = payload?.phone
      vendorSettingsModel.restaurantImage = await this.googleAdmin.uploadToStorage(
        identity,
        'logo',
        'image',
        'vendorProfile',
        payload?.mainPicture,
        vendorSettingsModel.restaurantImage
      )
      transaction = await Domain.SqlDB.sequelize.transaction({
        autocommit: false
      })
      await vendorSettingsModel.save({ transaction })
      const AddressModel = contractModel?.addresses?.[0]
      const address = payload?.address
      if (
        (AddressModel?.postalCode !== address.postalCode ||
          AddressModel?.number !== address.number ||
          AddressModel?.complement !== address.complement) &&
        Logics.Validations.validateAddress(address)
      ) {
        const location: Types.Classes.CLocation = await Utils.GoogleAdmin.getGeocoding(address)
        await AddressModel?.destroy({ transaction })
        await contractModel.$create(
          'address',
          {
            kind: Types.Types.TAddress.PROFESSIONAL,
            role: Types.Types.TRoles.VENDOR,
            postalCode: address?.postalCode,
            street: address?.street,
            number: address?.number,
            complement: address?.complement,
            neighborhood: address?.neighborhood,
            city: address?.city,
            distance: 0,
            duration: 0,
            stat: address?.stat,
            coordinates: BackendTypes.CGeometry.init(BackendTypes.TGeometry.POINT, [
              location.latitude ?? 0,
              location.longitude ?? 0
            ]).toJSON()
          },
          { transaction }
        )
      }
      await transaction.commit()
      return new Utils.Return(true, null)
    } catch (exception: any) {
      await transaction?.rollback()
      const error = new Utils.iKomidaError(
        Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_UPDATE_PROFILE_UPLOAD_Image_EXCEPTION,
        exception
      )
      return error.logAndReturn(this.logger)
    }
  }

  async integratePagseguroGateway(identity: Types.Classes.CUser, input: any) {
    try {
      const payload: Types.Classes.CvendorPagseguroIntegration =
        Types.Classes.CvendorPagseguroIntegration.fromObject(input)
      if (!payload.validate()) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_INTEGRATE_PAGSEGURO_MISSING_DATA)
        return error.logAndReturn(this.logger)
      }
      const contractModel = await DBModels.ContractModel.findOne({
        where: {
          [Domain.SqlDB.Op.and]: [
            {
              ikomidaID: identity.ikomidaID
            },
            {
              ikomidaID: {
                [Domain.SqlDB.Op.not]: 'com.ikomida.br.demo'
              }
            }
          ]
        },
        include: [
          {
            model: DBModels.UserModel,
            required: true,
            where: {
              id: identity.id,
              role: {
                [Domain.SqlDB.Op.in]: [Types.Types.TRoles.VENDOR, Types.Types.TRoles.STAFF]
              }
            }
          },
          {
            model: DBModels.VendorSettingsModel,
            required: true,
            include: [
              {
                model: DBModels.VendorPaymentGatewayModel,
                required: false
              }
            ]
          }
        ]
      })
      if (!contractModel || contractModel.ikomidaID !== payload?.state) {
        const error = new Utils.iKomidaError(
          Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_INTEGRATE_PAGSEGURO_INVALID_CONTRACT
        )
        return error.logAndReturn(this.logger)
      }
      const vendorSettingsModel = contractModel?.vendorSettings
      if (!vendorSettingsModel) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_INTEGRATE_PAGSEGURO_EMPTY)
        return error.logAndReturn(this.logger)
      }
      let vendorPaymentGatewayModel: DBModels.VendorPaymentGatewayModel | undefined =
        vendorSettingsModel?.vendorPaymentGateway
      if (vendorPaymentGatewayModel) {
        vendorPaymentGatewayModel.data = undefined
      }
      const pagseguroHelper = new Helpers.PagseguroHelper(this.logger)
      const paymentGateway = await pagseguroHelper.configure(vendorPaymentGatewayModel)
      if (!paymentGateway) {
        const error = new Utils.iKomidaError(
          Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_REVOKE_PAGSEGURO_INVALID_VENDOR_PAYMENT_SETTINGS
        )
        return error.logAndReturn(this.logger)
      }
      const response = await paymentGateway.getAccessToken(payload?.code)
      if (!response || !(response instanceof Types.Classes.Pagseguro.CPagSeguroGetAccessTokenResponse)) {
        const error = new Utils.iKomidaError(
          Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_INTEGRATE_PAGSEGURO_EMPTY_RESPONSE
        )
        return error.logAndReturn(this.logger)
      }

      const gatewayData = response.toJSON()
      if (vendorPaymentGatewayModel) {
        vendorPaymentGatewayModel.data = gatewayData
        await vendorPaymentGatewayModel.save()
      } else {
        vendorPaymentGatewayModel = (await vendorSettingsModel.$create('vendorPaymentGateway', {
          gateway: GateWays.PagSeguro.name,
          data: gatewayData,
          contractId: contractModel.id
        })) as DBModels.VendorPaymentGatewayModel
      }
      return new Utils.Return(
        true,
        Types.Classes.CVendorPaymentGateway.init(
          vendorPaymentGatewayModel?.gateway ?? '',
          response.access_token ? true : false
        )
      )
    } catch (exception: any) {
      const error = new Utils.iKomidaError(
        Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_INTEGRATE_PAGSEGURO_EXCEPTION,
        exception
      )
      return error.logAndReturn(this.logger)
    }
  }

  async revokePagseguroGateway(identity: Types.Classes.CUser) {
    try {
      const contractModel = await DBModels.ContractModel.findOne({
        where: {
          [Domain.SqlDB.Op.and]: [
            {
              ikomidaID: identity.ikomidaID
            },
            {
              ikomidaID: {
                [Domain.SqlDB.Op.not]: 'com.ikomida.br.demo'
              }
            }
          ]
        },
        include: [
          {
            model: DBModels.UserModel,
            required: true,
            where: {
              id: identity.id,
              role: {
                [Domain.SqlDB.Op.in]: [Types.Types.TRoles.VENDOR, Types.Types.TRoles.STAFF]
              }
            }
          },
          {
            model: DBModels.VendorSettingsModel,
            required: true,
            include: [
              {
                model: DBModels.VendorPaymentGatewayModel,
                required: false
              }
            ]
          }
        ]
      })
      if (!contractModel) {
        const error = new Utils.iKomidaError(
          Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_REVOKE_PAGSEGURO_INVALID_CONTRACT
        )
        return error.logAndReturn(this.logger)
      }
      const vendorSettingsModel = contractModel?.vendorSettings
      if (!vendorSettingsModel) {
        const error = new Utils.iKomidaError(
          Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_REVOKE_PAGSEGURO_INVALID_VENDOR_SETTINGS
        )
        return error.logAndReturn(this.logger)
      }
      const vendorPaymentGatewayModel = vendorSettingsModel?.vendorPaymentGateway
      if (vendorPaymentGatewayModel) {
        const pagseguroHelper = new Helpers.PagseguroHelper(this.logger)
        const paymentGateway = (await pagseguroHelper.configure(vendorPaymentGatewayModel)) as GateWays.PagSeguro
        await paymentGateway?.revokeToken()
        await vendorPaymentGatewayModel?.destroy()
      }
      return new Utils.Return(
        true,
        Types.Classes.CVendorPaymentGateway.init(vendorPaymentGatewayModel?.gateway ?? '', false)
      )
    } catch (exception: any) {
      const error = new Utils.iKomidaError(
        Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_SET_REVOKE_PAGSEGURO_EXCEPTION,
        exception
      )
      return error.logAndReturn(this.logger)
    }
  }

  async updateBusinessHours(identity: Types.Classes.CUser, object: any) {
    try {
      const businessTime: Types.Classes.CBusinessTime = Types.Classes.CBusinessTime.fromObject(object)
      if (!businessTime.validate()) {
        const error = new Utils.iKomidaError(
          Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_UPDATE_BUSNIESS_HOURS_MISSING_DATA
        )
        return error.logAndReturn(this.logger)
      }
      const contractModel = await DBModels.ContractModel.findOne({
        where: {
          ikomidaID: identity.ikomidaID
        },
        include: [
          {
            model: DBModels.UserModel,
            required: true,
            where: {
              id: identity.id,
              role: {
                [Domain.SqlDB.Op.in]: [Types.Types.TRoles.VENDOR, Types.Types.TRoles.STAFF]
              }
            }
          },
          {
            model: DBModels.VendorSettingsModel,
            required: true
          }
        ]
      })
      if (!contractModel) {
        const error = new Utils.iKomidaError(
          Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_UPDATE_BUSNIESS_HOURS_INVALID_CONTRACT
        )
        return error.logAndReturn(this.logger)
      }
      const vendorSettingsModel = contractModel?.vendorSettings
      if (!vendorSettingsModel) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_UPDATE_BUSNIESS_HOURS_EMPTY)
        return error.logAndReturn(this.logger)
      }
      vendorSettingsModel.businessHours = businessTime?.hours
      vendorSettingsModel.businessDays = businessTime?.days
      await vendorSettingsModel.save()
      return new Utils.Return(true, null)
    } catch (exception: any) {
      const error = new Utils.iKomidaError(
        Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_UPDATE_BUSNIESS_HOURS_EXCEPTION,
        exception
      )
      return error.logAndReturn(this.logger)
    }
  }

  async updateDelivery(identity: Types.Classes.CUser, object: any) {
    try {
      const vendorSettings: Types.Classes.CVendorSettings = Types.Classes.CVendorSettings.fromObject(object)
      if (!vendorSettings.validate()) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_UPDATE_DELIVERY_MISSING_DATA)
        return error.logAndReturn(this.logger)
      }
      const contractModel = await DBModels.ContractModel.findOne({
        where: {
          ikomidaID: identity.ikomidaID
        },
        include: [
          {
            model: DBModels.UserModel,
            required: true,
            where: {
              id: identity.id,
              role: {
                [Domain.SqlDB.Op.in]: [Types.Types.TRoles.VENDOR, Types.Types.TRoles.STAFF]
              }
            }
          },
          {
            model: DBModels.VendorSettingsModel,
            required: true
          }
        ]
      })
      if (!contractModel) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_UPDATE_DELIVERY_INVALID_CONTRACT)
        return error.logAndReturn(this.logger)
      }
      const vendorSettingsModel = contractModel?.vendorSettings
      if (!vendorSettingsModel) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_UPDATE_DELIVERY_EMPTY)
        return error.logAndReturn(this.logger)
      }
      if (vendorSettingsModel) {
        vendorSettingsModel.delivery =
          Logics.Finances.toFinanceNumber(vendorSettings?.delivery?.value) ?? vendorSettingsModel.delivery
        vendorSettingsModel.deliveryMin =
          Logics.Finances.toFinanceNumber(vendorSettings?.delivery?.min) ?? vendorSettingsModel.deliveryMin
        vendorSettingsModel.orderMinValue =
          Logics.Finances.toFinanceNumber(vendorSettings?.delivery?.orderMinValue) ?? vendorSettingsModel.orderMinValue
        vendorSettingsModel.deliveryFree = vendorSettings?.delivery?.free ?? vendorSettingsModel.deliveryFree
        vendorSettingsModel.preparationMin =
          Logics.Finances.toFinanceNumber(vendorSettings?.preparation?.min) ?? vendorSettingsModel.preparationMin
        vendorSettingsModel.preparationMax =
          Logics.Finances.toFinanceNumber(vendorSettings?.preparation?.max) ?? vendorSettingsModel.preparationMax
        console.log('vendorSettings?.orderTypes:', vendorSettings?.orderTypes)
        vendorSettingsModel.orderTypes = vendorSettings?.orderTypes ?? vendorSettingsModel.orderTypes
        vendorSettingsModel.tip = Logics.Finances.toFinanceNumber(vendorSettings?.tip) ?? vendorSettingsModel.tip
      }
      await vendorSettingsModel.save()
      return new Utils.Return(true, null)
    } catch (exception: any) {
      const error = new Utils.iKomidaError(
        Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_UPDATE_DELIVERY_EXCEPTION,
        exception
      )
      return error.logAndReturn(this.logger)
    }
  }

  async getLimits(identity: Types.Classes.CUser) {
    try {
      //TODO: -- make it as a single transaction
      const contractModel = await DBModels.ContractModel.findOne({
        where: {
          ikomidaID: identity.ikomidaID
        },
        include: [
          {
            model: DBModels.UserModel,
            required: true,
            where: {
              id: identity.id,
              role: {
                [Domain.SqlDB.Op.in]: [Types.Types.TRoles.VENDOR, Types.Types.TRoles.STAFF]
              }
            }
          },
          {
            model: DBModels.PlanModel,
            required: true
          },
          {
            model: DBModels.ContractPaymentSignatureModel,
            required: false
          }
        ]
      })
      if (!contractModel) {
        throw new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_PAYMENTS_SERVICE_NEW_PAYMENT_METHOD_INVALID_CONTRACT)
      }
      const stafs =
        (await contractModel?.$count('users', {
          where: {
            role: {
              [Domain.SqlDB.Op.in]: [Types.Types.TRoles.VENDOR, Types.Types.TRoles.STAFF]
            }
          }
        })) ?? 0
      const products = (await contractModel?.$count('products')) ?? 0
      const coupons = (await contractModel?.$count('coupons')) ?? 0
      const productCategories = (await contractModel?.$count('productCategories')) ?? 0
      const pushNotifications =
        (await contractModel?.$count('vendorPNMessages', {
          where: {
            createdAt: {
              [Domain.SqlDB.Op.gte]: contractModel.contractPaymentSignature?.lastDueDate
            }
          }
        })) ?? 0
      const orders =
        (await contractModel?.$get('orders', {
          where: {
            createdAt: {
              [Domain.SqlDB.Op.gte]: contractModel.contractPaymentSignature?.lastDueDate
            },
            status: {
              [Domain.SqlDB.Op.notIn]: [Types.Types.TOrderStatus.CANCELED]
            }
          }
        })) ?? 0
      const ordersTotal = orders?.map(order => (order?.subtotal ?? 0) + (order?.delivery ?? 0) - (order?.discount ?? 0))
      const vendorLimits = Types.Classes.CVendorLimits.init(
        Types.Classes.CVendorLimit.init(contractModel?.plan?.staff ?? -1, stafs),
        Types.Classes.CVendorLimit.init(contractModel?.plan?.products ?? -1, products ?? 0),
        Types.Classes.CVendorLimit.init(contractModel?.plan?.orders ?? -1, orders.length),
        Types.Classes.CVendorLimit.init(contractModel?.plan?.coupons ?? -1, coupons ?? 0),
        Types.Classes.CVendorLimit.init(contractModel?.plan?.categories ?? -1, productCategories ?? 0),
        Types.Classes.CVendorLimit.init(contractModel?.plan?.pushNotifications ?? -1, pushNotifications ?? 0),
        Types.Classes.CVendorLimit.init(
          contractModel?.plan?.billing ?? -1,
          (ordersTotal?.length ?? 0) > 0 ? ordersTotal?.reduce((a, b) => a + b) ?? 0 : 1
        )
      )
      return new Utils.Return(true, vendorLimits)
    } catch (exception: any) {
      let error = new Utils.iKomidaError(
        Utils.iKomidaError.IKOMIDA_PAYMENTS_SERVICE_NEW_PAYMENT_METHOD_EXCEPTION,
        exception
      )
      if (exception instanceof Utils.iKomidaError) {
        error = exception
      }
      return error.logAndReturn(this.logger)
    }
  }

  validateBusinessHoursObject(object: Types.Classes.CBusinessTime) {
    if (!objHasProp(['days', 'hours'], object)) {
      return false
    }
    if (
      !Array.isArray(object.hours) ||
      object.hours.length < 1 ||
      !Array.isArray(object.days) ||
      object.days.length < 1
    ) {
      return false
    }
    for (const hours of object.hours) {
      if (!objHasProp(['start', 'end'], hours)) {
        return false
      }
    }
    return true
  }
}
